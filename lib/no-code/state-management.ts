"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { NoCodeProject, ProjectListItem } from "./project-persistence";
import { GeneratedContract } from "./code-generator";

// Application mode
export type AppMode = "code-editor" | "no-code-builder";

// No-code builder state
export interface NoCodeBuilderState {
  // Current project
  currentProject: NoCodeProject | null;
  isProjectLoaded: boolean;
  isProjectSaving: boolean;

  // Editor state
  editorData: any;
  selectedNodes: string[];
  isGenerating: boolean;
  generatedContract: GeneratedContract | null;

  // UI state
  activeTab: "editor" | "code" | "deploy";
  sidebarCollapsed: boolean;
  paletteCollapsed: boolean;

  // Project management
  recentProjects: ProjectListItem[];
  projectTemplates: any[];

  // Settings
  autoSave: boolean;
  autoGenerate: boolean;
  showMinimap: boolean;
  gridSnap: boolean;
}

// Global application state
export interface AppState {
  // Current mode
  mode: AppMode;

  // Navigation
  previousMode: AppMode | null;
  navigationHistory: AppMode[];

  // Cross-page data sharing
  sharedData: {
    deploymentConfig?: any;
    compiledContract?: any;
    lastGeneratedCode?: string;
  };

  // No-code builder state
  noCodeBuilder: NoCodeBuilderState;

  // Actions
  setMode: (mode: AppMode) => void;
  navigateToMode: (mode: AppMode) => void;
  goBack: () => void;

  // Shared data actions
  setSharedData: (key: keyof AppState["sharedData"], value: any) => void;
  clearSharedData: () => void;

  // No-code builder actions
  setCurrentProject: (project: NoCodeProject | null) => void;
  setProjectLoaded: (loaded: boolean) => void;
  setProjectSaving: (saving: boolean) => void;
  setEditorData: (data: any) => void;
  setSelectedNodes: (nodes: string[]) => void;
  setGenerating: (generating: boolean) => void;
  setGeneratedContract: (contract: GeneratedContract | null) => void;
  setActiveTab: (tab: NoCodeBuilderState["activeTab"]) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setPaletteCollapsed: (collapsed: boolean) => void;
  setRecentProjects: (projects: ProjectListItem[]) => void;
  setAutoSave: (autoSave: boolean) => void;
  setAutoGenerate: (autoGenerate: boolean) => void;
  setShowMinimap: (showMinimap: boolean) => void;
  setGridSnap: (gridSnap: boolean) => void;

  // Utility actions
  resetNoCodeBuilder: () => void;
  updateProjectMetadata: (updates: Partial<NoCodeProject["metadata"]>) => void;
}

// Initial no-code builder state
const initialNoCodeBuilderState: NoCodeBuilderState = {
  currentProject: null,
  isProjectLoaded: false,
  isProjectSaving: false,
  editorData: null,
  selectedNodes: [],
  isGenerating: false,
  generatedContract: null,
  activeTab: "editor",
  sidebarCollapsed: false,
  paletteCollapsed: false,
  recentProjects: [],
  projectTemplates: [],
  autoSave: true,
  autoGenerate: true,
  showMinimap: true,
  gridSnap: true,
};

// Create the main app store
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      mode: "code-editor",
      previousMode: null,
      navigationHistory: ["code-editor"],
      sharedData: {},
      noCodeBuilder: initialNoCodeBuilderState,

      // Navigation actions
      setMode: (mode) => {
        const currentMode = get().mode;
        set((state) => ({
          previousMode: currentMode,
          mode,
          navigationHistory: [...state.navigationHistory, mode],
        }));
      },

      navigateToMode: (mode) => {
        const { setMode } = get();
        setMode(mode);

        // Navigate using Next.js router
        if (typeof window !== "undefined") {
          const path = mode === "code-editor" ? "/" : "/no-code";
          window.history.pushState(null, "", path);
        }
      },

      goBack: () => {
        const { previousMode, navigationHistory } = get();
        if (previousMode) {
          const newHistory = navigationHistory.slice(0, -1);
          set({
            mode: previousMode,
            previousMode: newHistory[newHistory.length - 2] || null,
            navigationHistory: newHistory,
          });

          // Navigate using Next.js router
          if (typeof window !== "undefined") {
            const path = previousMode === "code-editor" ? "/" : "/no-code";
            window.history.pushState(null, "", path);
          }
        }
      },

      // Shared data actions
      setSharedData: (key, value) => {
        set((state) => ({
          sharedData: {
            ...state.sharedData,
            [key]: value,
          },
        }));
      },

      clearSharedData: () => {
        set({ sharedData: {} });
      },

      // No-code builder actions
      setCurrentProject: (project) => {
        set((state) => ({
          noCodeBuilder: {
            ...state.noCodeBuilder,
            currentProject: project,
          },
        }));
      },

      setProjectLoaded: (loaded) => {
        set((state) => ({
          noCodeBuilder: {
            ...state.noCodeBuilder,
            isProjectLoaded: loaded,
          },
        }));
      },

      setProjectSaving: (saving) => {
        set((state) => ({
          noCodeBuilder: {
            ...state.noCodeBuilder,
            isProjectSaving: saving,
          },
        }));
      },

      setEditorData: (data) => {
        set((state) => ({
          noCodeBuilder: {
            ...state.noCodeBuilder,
            editorData: data,
          },
        }));
      },

      setSelectedNodes: (nodes) => {
        set((state) => ({
          noCodeBuilder: {
            ...state.noCodeBuilder,
            selectedNodes: nodes,
          },
        }));
      },

      setGenerating: (generating) => {
        set((state) => ({
          noCodeBuilder: {
            ...state.noCodeBuilder,
            isGenerating: generating,
          },
        }));
      },

      setGeneratedContract: (contract) => {
        set((state) => ({
          noCodeBuilder: {
            ...state.noCodeBuilder,
            generatedContract: contract,
          },
        }));
      },

      setActiveTab: (tab) => {
        set((state) => ({
          noCodeBuilder: {
            ...state.noCodeBuilder,
            activeTab: tab,
          },
        }));
      },

      setSidebarCollapsed: (collapsed) => {
        set((state) => ({
          noCodeBuilder: {
            ...state.noCodeBuilder,
            sidebarCollapsed: collapsed,
          },
        }));
      },

      setPaletteCollapsed: (collapsed) => {
        set((state) => ({
          noCodeBuilder: {
            ...state.noCodeBuilder,
            paletteCollapsed: collapsed,
          },
        }));
      },

      setRecentProjects: (projects) => {
        set((state) => ({
          noCodeBuilder: {
            ...state.noCodeBuilder,
            recentProjects: projects,
          },
        }));
      },

      setAutoSave: (autoSave) => {
        set((state) => ({
          noCodeBuilder: {
            ...state.noCodeBuilder,
            autoSave,
          },
        }));
      },

      setAutoGenerate: (autoGenerate) => {
        set((state) => ({
          noCodeBuilder: {
            ...state.noCodeBuilder,
            autoGenerate,
          },
        }));
      },

      setShowMinimap: (showMinimap) => {
        set((state) => ({
          noCodeBuilder: {
            ...state.noCodeBuilder,
            showMinimap,
          },
        }));
      },

      setGridSnap: (gridSnap) => {
        set((state) => ({
          noCodeBuilder: {
            ...state.noCodeBuilder,
            gridSnap,
          },
        }));
      },

      // Utility actions
      resetNoCodeBuilder: () => {
        set((state) => ({
          noCodeBuilder: initialNoCodeBuilderState,
        }));
      },

      updateProjectMetadata: (updates) => {
        set((state) => {
          if (!state.noCodeBuilder.currentProject) return state;

          return {
            noCodeBuilder: {
              ...state.noCodeBuilder,
              currentProject: {
                ...state.noCodeBuilder.currentProject,
                metadata: {
                  ...state.noCodeBuilder.currentProject.metadata,
                  ...updates,
                  updated: new Date(),
                },
              },
            },
          };
        });
      },
    }),
    {
      name: "solmix-app-state",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        mode: state.mode,
        noCodeBuilder: {
          autoSave: state.noCodeBuilder.autoSave,
          autoGenerate: state.noCodeBuilder.autoGenerate,
          showMinimap: state.noCodeBuilder.showMinimap,
          gridSnap: state.noCodeBuilder.gridSnap,
          sidebarCollapsed: state.noCodeBuilder.sidebarCollapsed,
          paletteCollapsed: state.noCodeBuilder.paletteCollapsed,
        },
      }),
    }
  )
);

// Selector hooks for better performance
export const useCurrentMode = () => useAppStore((state) => state.mode);
export const useNoCodeBuilder = () =>
  useAppStore((state) => state.noCodeBuilder);
export const useCurrentProject = () =>
  useAppStore((state) => state.noCodeBuilder.currentProject);
export const useGeneratedContract = () =>
  useAppStore((state) => state.noCodeBuilder.generatedContract);
export const useSharedData = () => useAppStore((state) => state.sharedData);

// Action hooks
export const useAppActions = () => {
  const store = useAppStore();
  return {
    setMode: store.setMode,
    navigateToMode: store.navigateToMode,
    goBack: store.goBack,
    setSharedData: store.setSharedData,
    clearSharedData: store.clearSharedData,
  };
};

export const useNoCodeActions = () => {
  const store = useAppStore();
  return {
    setCurrentProject: store.setCurrentProject,
    setProjectLoaded: store.setProjectLoaded,
    setProjectSaving: store.setProjectSaving,
    setEditorData: store.setEditorData,
    setSelectedNodes: store.setSelectedNodes,
    setGenerating: store.setGenerating,
    setGeneratedContract: store.setGeneratedContract,
    setActiveTab: store.setActiveTab,
    setSidebarCollapsed: store.setSidebarCollapsed,
    setPaletteCollapsed: store.setPaletteCollapsed,
    setRecentProjects: store.setRecentProjects,
    setAutoSave: store.setAutoSave,
    setAutoGenerate: store.setAutoGenerate,
    setShowMinimap: store.setShowMinimap,
    setGridSnap: store.setGridSnap,
    resetNoCodeBuilder: store.resetNoCodeBuilder,
    updateProjectMetadata: store.updateProjectMetadata,
  };
};

// Navigation utilities
export const getNavigationPath = (mode: AppMode): string => {
  return mode === "code-editor" ? "/" : "/no-code";
};

export const getCurrentModeFromPath = (pathname: string): AppMode => {
  return pathname.startsWith("/no-code") ? "no-code-builder" : "code-editor";
};

// Auto-save functionality
let autoSaveTimeout: NodeJS.Timeout | null = null;

export const scheduleAutoSave = (
  callback: () => Promise<void>,
  delay: number = 5000
) => {
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }

  autoSaveTimeout = setTimeout(async () => {
    try {
      await callback();
    } catch (error) {
      console.error("Auto-save failed:", error);
    }
  }, delay);
};

export const cancelAutoSave = () => {
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = null;
  }
};

// Integration with existing SolMix deployment
export const prepareForDeployment = (contract: GeneratedContract) => {
  const { setSharedData } = useAppStore.getState();

  // Share contract data with the main IDE
  setSharedData("compiledContract", {
    sourceCode: contract.sourceCode,
    abi: contract.abi,
    bytecode: contract.bytecode,
    name: contract.name,
    metadata: contract.metadata,
  });

  setSharedData("lastGeneratedCode", contract.sourceCode);
};

export default useAppStore;
