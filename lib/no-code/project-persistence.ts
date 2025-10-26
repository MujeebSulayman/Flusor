import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { NodeEditor } from 'rete';
import { GeneratedContract } from './code-generator';

// Database schema
interface NoCodeDB extends DBSchema {
  projects: {
    key: string;
    value: NoCodeProject;
    indexes: {
      'by-name': string;
      'by-updated': Date;
    };
  };
  templates: {
    key: string;
    value: NoCodeTemplate;
    indexes: {
      'by-category': string;
    };
  };
}

// Project data structure
export interface NoCodeProject {
  id: string;
  name: string;
  description?: string;
  editorData: any; // Rete.js editor data
  generatedContract?: GeneratedContract;
  metadata: {
    created: Date;
    updated: Date;
    version: string;
    tags?: string[];
  };
  settings: {
    contractName: string;
    solidityVersion: string;
    license: string;
    optimization: boolean;
  };
}

// Template data structure
export interface NoCodeTemplate {
  id: string;
  name: string;
  description: string;
  category: 'token' | 'defi' | 'nft' | 'governance' | 'utility' | 'custom';
  editorData: any;
  previewImage?: string;
  metadata: {
    created: Date;
    author: string;
    version: string;
    tags: string[];
  };
}

// Project list item for UI
export interface ProjectListItem {
  id: string;
  name: string;
  description?: string;
  updated: Date;
  tags?: string[];
  contractName: string;
}

class ProjectPersistenceService {
  private db: IDBPDatabase<NoCodeDB> | null = null;
  private readonly DB_NAME = 'solmix-nocode';
  private readonly DB_VERSION = 1;

  async init(): Promise<void> {
    if (typeof window === 'undefined') {
      console.warn('IndexedDB not available in server environment');
      return;
    }
    
    try {
      this.db = await openDB<NoCodeDB>(this.DB_NAME, this.DB_VERSION, {
        upgrade(db) {
          // Projects store
          const projectStore = db.createObjectStore('projects', {
            keyPath: 'id'
          });
          projectStore.createIndex('by-name', 'name');
          projectStore.createIndex('by-updated', 'metadata.updated');

          // Templates store
          const templateStore = db.createObjectStore('templates', {
            keyPath: 'id'
          });
          templateStore.createIndex('by-category', 'category');
        }
      });
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      throw new Error('Failed to initialize project persistence');
    }
  }

  private ensureDB(): IDBPDatabase<NoCodeDB> {
    if (typeof window === 'undefined') {
      throw new Error('IndexedDB not available in server environment');
    }
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return this.db;
  }

  // Project operations
  async saveProject(project: NoCodeProject): Promise<void> {
    const db = this.ensureDB();
    
    try {
      // Update metadata
      project.metadata.updated = new Date();
      
      await db.put('projects', project);
    } catch (error) {
      console.error('Failed to save project:', error);
      throw new Error('Failed to save project');
    }
  }

  async loadProject(id: string): Promise<NoCodeProject | null> {
    const db = this.ensureDB();
    
    try {
      const project = await db.get('projects', id);
      return project || null;
    } catch (error) {
      console.error('Failed to load project:', error);
      throw new Error('Failed to load project');
    }
  }

  async deleteProject(id: string): Promise<void> {
    const db = this.ensureDB();
    
    try {
      await db.delete('projects', id);
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw new Error('Failed to delete project');
    }
  }

  async listProjects(): Promise<ProjectListItem[]> {
    const db = this.ensureDB();
    
    try {
      const projects = await db.getAll('projects');
      
      return projects
        .map(project => ({
          id: project.id,
          name: project.name,
          description: project.description,
          updated: project.metadata.updated,
          tags: project.metadata.tags,
          contractName: project.settings.contractName
        }))
        .sort((a, b) => b.updated.getTime() - a.updated.getTime());
    } catch (error) {
      console.error('Failed to list projects:', error);
      throw new Error('Failed to list projects');
    }
  }

  async duplicateProject(id: string, newName: string): Promise<NoCodeProject> {
    const originalProject = await this.loadProject(id);
    if (!originalProject) {
      throw new Error('Project not found');
    }

    const duplicatedProject: NoCodeProject = {
      ...originalProject,
      id: this.generateId(),
      name: newName,
      metadata: {
        ...originalProject.metadata,
        created: new Date(),
        updated: new Date()
      },
      settings: {
        ...originalProject.settings,
        contractName: newName.replace(/\s+/g, '')
      }
    };

    await this.saveProject(duplicatedProject);
    return duplicatedProject;
  }

  // Template operations
  async saveTemplate(template: NoCodeTemplate): Promise<void> {
    const db = this.ensureDB();
    
    try {
      await db.put('templates', template);
    } catch (error) {
      console.error('Failed to save template:', error);
      throw new Error('Failed to save template');
    }
  }

  async loadTemplate(id: string): Promise<NoCodeTemplate | null> {
    const db = this.ensureDB();
    
    try {
      const template = await db.get('templates', id);
      return template || null;
    } catch (error) {
      console.error('Failed to load template:', error);
      throw new Error('Failed to load template');
    }
  }

  async listTemplates(category?: string): Promise<NoCodeTemplate[]> {
    const db = this.ensureDB();
    
    try {
      if (category) {
        return await db.getAllFromIndex('templates', 'by-category', category);
      }
      return await db.getAll('templates');
    } catch (error) {
      console.error('Failed to list templates:', error);
      throw new Error('Failed to list templates');
    }
  }

  // Export/Import operations
  async exportProject(id: string): Promise<string> {
    const project = await this.loadProject(id);
    if (!project) {
      throw new Error('Project not found');
    }

    return JSON.stringify({
      version: '1.0',
      type: 'solmix-nocode-project',
      data: project
    }, null, 2);
  }

  async importProject(jsonData: string): Promise<NoCodeProject> {
    try {
      const importData = JSON.parse(jsonData);
      
      if (importData.type !== 'solmix-nocode-project') {
        throw new Error('Invalid project file format');
      }

      const project: NoCodeProject = {
        ...importData.data,
        id: this.generateId(), // Generate new ID
        metadata: {
          ...importData.data.metadata,
          created: new Date(),
          updated: new Date()
        }
      };

      await this.saveProject(project);
      return project;
    } catch (error) {
      console.error('Failed to import project:', error);
      throw new Error('Failed to import project');
    }
  }

  // Utility methods
  async createNewProject(name: string, description?: string): Promise<NoCodeProject> {
    const project: NoCodeProject = {
      id: this.generateId(),
      name,
      description,
      editorData: {
        nodes: {},
        connections: {}
      },
      metadata: {
        created: new Date(),
        updated: new Date(),
        version: '1.0',
        tags: []
      },
      settings: {
        contractName: name.replace(/\s+/g, ''),
        solidityVersion: '0.8.19',
        license: 'MIT',
        optimization: true
      }
    };

    await this.saveProject(project);
    return project;
  }

  async createProjectFromTemplate(templateId: string, name: string): Promise<NoCodeProject> {
    const template = await this.loadTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const project: NoCodeProject = {
      id: this.generateId(),
      name,
      description: `Created from ${template.name} template`,
      editorData: template.editorData,
      metadata: {
        created: new Date(),
        updated: new Date(),
        version: '1.0',
        tags: [...template.metadata.tags]
      },
      settings: {
        contractName: name.replace(/\s+/g, ''),
        solidityVersion: '0.8.19',
        license: 'MIT',
        optimization: true
      }
    };

    await this.saveProject(project);
    return project;
  }

  private generateId(): string {
    return `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Search and filter
  async searchProjects(query: string): Promise<ProjectListItem[]> {
    const projects = await this.listProjects();
    const lowercaseQuery = query.toLowerCase();
    
    return projects.filter(project => 
      project.name.toLowerCase().includes(lowercaseQuery) ||
      project.description?.toLowerCase().includes(lowercaseQuery) ||
      project.contractName.toLowerCase().includes(lowercaseQuery) ||
      project.tags?.some(tag => tag.toLowerCase().includes(lowercaseQuery))
    );
  }

  async getProjectsByTag(tag: string): Promise<ProjectListItem[]> {
    const projects = await this.listProjects();
    return projects.filter(project => 
      project.tags?.includes(tag)
    );
  }

  // Database maintenance
  async clearAllData(): Promise<void> {
    const db = this.ensureDB();
    
    try {
      await db.clear('projects');
      await db.clear('templates');
    } catch (error) {
      console.error('Failed to clear data:', error);
      throw new Error('Failed to clear data');
    }
  }

  async getStorageInfo(): Promise<{ projectCount: number; templateCount: number }> {
    const db = this.ensureDB();
    
    try {
      const [projectCount, templateCount] = await Promise.all([
        db.count('projects'),
        db.count('templates')
      ]);
      
      return { projectCount, templateCount };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      throw new Error('Failed to get storage info');
    }
  }
}

// Singleton instance
export const projectPersistence = new ProjectPersistenceService();

// Initialize on module load
if (typeof window !== 'undefined') {
  projectPersistence.init().catch(console.error);
}

export default projectPersistence;