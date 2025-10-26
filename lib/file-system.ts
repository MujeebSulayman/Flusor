export interface FileNode {
  id: string;
  name: string;
  type: "file" | "folder";
  content?: string;
  children?: string[];
  parentId?: string;
  extension?: string;
  createdAt: number;
  modifiedAt: number;
}

export interface FileTreeNode extends Omit<FileNode, "children"> {
  children?: FileTreeNode[];
}

export interface FileSystemState {
  files: Record<string, FileNode>;
  rootFiles: string[];
}

import { fileStorage, migrateFromLocalStorage } from './indexeddb-storage';

const STORAGE_KEY = "solmix-files";

export class FileSystem {
  private static instance: FileSystem;
  private state: FileSystemState;
  private initPromise: Promise<void> | null = null;

  private constructor() {
    this.state = { files: {}, rootFiles: [] };
    this.initPromise = this.initializeStorage();
  }

  static getInstance(): FileSystem {
    if (!FileSystem.instance) {
      FileSystem.instance = new FileSystem();
    }
    return FileSystem.instance;
  }

  private async initializeStorage(): Promise<void> {
    if (typeof window === "undefined") {
      return;
    }

    try {
      // Initialize IndexedDB
      await fileStorage.init();
      
      // Try to migrate from localStorage first
      await migrateFromLocalStorage();
      
      // Load existing data or create default files
      const stored = await fileStorage.getItem(STORAGE_KEY);
      
      if (stored) {
        this.state = stored;
      } else {
        // Initialize with default files
        const defaultState = this.createDefaultFiles();
        await this.saveToStorage(defaultState);
        this.state = defaultState;
      }
    } catch (error) {
      console.error("Failed to initialize IndexedDB storage:", error);
      // Fallback to creating default files in memory
      this.state = this.createDefaultFiles();
    }
  }


  private createDefaultFiles(): FileSystemState {
    const contractsFolder: FileNode = {
      id: "contracts",
      name: "contracts",
      type: "folder",
      children: [],
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };

    const scriptsFolder: FileNode = {
      id: "scripts",
      name: "scripts",
      type: "folder",
      children: [],
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };

    const testFolder: FileNode = {
      id: "test",
      name: "test",
      type: "folder",
      children: [],
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };

    const sampleContract: FileNode = {
      id: "sample-contract",
      name: "HelloWorld.sol",
      type: "file",
      extension: "sol",
      parentId: "contracts",
      content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract HelloWorld {
    string public message;
    
    constructor(string memory _message) {
        message = _message;
    }
    
    function setMessage(string memory _message) public {
        message = _message;
    }
    
    function getMessage() public view returns (string memory) {
        return message;
    }
}`,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };

    const advancedContract: FileNode = {
      id: "advanced-contract",
      name: "AdvancedExample.sol",
      type: "file",
      extension: "sol",
      parentId: "contracts",
      content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @title Advanced Solidity Example
/// @notice This contract demonstrates advanced Solidity features
/// @dev Shows IntelliSense capabilities with events, errors, modifiers
contract AdvancedExample is ERC20, Ownable, ReentrancyGuard {
    // Custom errors for gas efficiency
    error InsufficientBalance(uint256 requested, uint256 available);
    error InvalidAddress();
    error TransferFailed();
    
    // Events for logging
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    event RewardDistributed(address indexed recipient, uint256 amount);
    
    // State variables
    mapping(address => uint256) public rewards;
    mapping(address => bool) public whitelist;
    uint256 public totalRewards;
    uint256 public constant MAX_SUPPLY = 1000000 * 10**18;
    
    // Modifiers
    modifier onlyWhitelisted() {
        require(whitelist[msg.sender], "Not whitelisted");
        _;
    }
    
    modifier validAddress(address _addr) {
        if (_addr == address(0)) revert InvalidAddress();
        _;
    }
    
    constructor() ERC20("AdvancedToken", "ADV") {
        _mint(msg.sender, 100000 * 10**18);
        whitelist[msg.sender] = true;
    }
    
    /// @notice Mint tokens to specified address
    /// @param to Address to mint tokens to
    /// @param amount Amount of tokens to mint
    function mint(address to, uint256 amount) 
        external 
        onlyOwner 
        validAddress(to) 
    {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }
    
    /// @notice Burn tokens from caller's balance
    /// @param amount Amount of tokens to burn
    function burn(uint256 amount) external {
        uint256 balance = balanceOf(msg.sender);
        if (balance < amount) {
            revert InsufficientBalance(amount, balance);
        }
        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount);
    }
    
    /// @notice Distribute rewards to whitelisted users
    /// @param recipients Array of recipient addresses
    /// @param amounts Array of reward amounts
    function distributeRewards(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwner nonReentrant {
        require(recipients.length == amounts.length, "Array length mismatch");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            address recipient = recipients[i];
            uint256 amount = amounts[i];
            
            if (recipient == address(0)) continue;
            
            rewards[recipient] += amount;
            totalRewards += amount;
            
            emit RewardDistributed(recipient, amount);
        }
    }
    
    /// @notice Claim accumulated rewards
    function claimRewards() external onlyWhitelisted nonReentrant {
        uint256 reward = rewards[msg.sender];
        require(reward > 0, "No rewards to claim");
        
        rewards[msg.sender] = 0;
        totalRewards -= reward;
        
        (bool success, ) = payable(msg.sender).call{value: reward}("");
        if (!success) revert TransferFailed();
    }
    
    /// @notice Add address to whitelist
    /// @param user Address to whitelist
    function addToWhitelist(address user) external onlyOwner validAddress(user) {
        whitelist[user] = true;
    }
    
    /// @notice Remove address from whitelist
    /// @param user Address to remove from whitelist
    function removeFromWhitelist(address user) external onlyOwner {
        whitelist[user] = false;
    }
    
    /// @notice Get contract balance
    /// @return Contract's ETH balance
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /// @notice Receive ETH
    receive() external payable {}
    
    /// @notice Fallback function
    fallback() external payable {}
}`,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };

    const sampleScript: FileNode = {
      id: "sample-script",
      name: "deploy.js",
      type: "file",
      extension: "js",
      parentId: "scripts",
      content: `// Sample deployment script
const { ethers } = require('hardhat');

async function main() {
    const HelloWorld = await ethers.getContractFactory('HelloWorld');
    const helloWorld = await HelloWorld.deploy('Hello, World!');
    
    await helloWorld.deployed();
    
    console.log('HelloWorld deployed to:', helloWorld.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });`,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };

    const sampleTest: FileNode = {
      id: "sample-test",
      name: "HelloWorld.test.js",
      type: "file",
      extension: "js",
      parentId: "test",
      content: `const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HelloWorld", function () {
  let helloWorld;
  let owner;
  let addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    
    const HelloWorld = await ethers.getContractFactory("HelloWorld");
    helloWorld = await HelloWorld.deploy("Hello, World!");
    await helloWorld.deployed();
  });

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      expect(helloWorld.address).to.not.equal(0);
    });

    it("Should set the initial message", async function () {
      expect(await helloWorld.getMessage()).to.equal("Hello, World!");
    });
  });

  describe("Message functionality", function () {
    it("Should update message", async function () {
      await helloWorld.setMessage("New message");
      expect(await helloWorld.getMessage()).to.equal("New message");
    });

    it("Should emit event on message change", async function () {
      await expect(helloWorld.setMessage("Test message"))
        .to.emit(helloWorld, "MessageChanged")
        .withArgs("Test message");
    });
  });
});`,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };

    contractsFolder.children = [sampleContract.id, advancedContract.id];
    scriptsFolder.children = [sampleScript.id];
    testFolder.children = [sampleTest.id];

    return {
      files: {
        [contractsFolder.id]: contractsFolder,
        [scriptsFolder.id]: scriptsFolder,
        [testFolder.id]: testFolder,
        [sampleContract.id]: sampleContract,
        [advancedContract.id]: advancedContract,
        [sampleScript.id]: sampleScript,
        [sampleTest.id]: sampleTest,
      },
      rootFiles: [contractsFolder.id, scriptsFolder.id, testFolder.id],
    };
  }

  private async saveToStorage(state?: FileSystemState): Promise<void> {
    if (typeof window === "undefined") return;

    try {
      await this.ensureInitialized();
      const stateToSave = state || this.state;
      console.log('[FILE SYSTEM] Saving to IndexedDB...', { fileCount: Object.keys(stateToSave.files).length });
      await fileStorage.setItem(STORAGE_KEY, stateToSave);
      console.log('[FILE SYSTEM] Successfully saved to IndexedDB');
    } catch (error) {
      console.error("Failed to save files to IndexedDB:", error);
    }
  }

  // File operations
  createFile(name: string, parentId?: string, extension = "sol"): FileNode {
    const id = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const file: FileNode = {
      id,
      name,
      type: "file",
      extension,
      parentId,
      content: this.getDefaultContent(extension),
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };

    this.state.files[id] = file;

    if (parentId && this.state.files[parentId]) {
      const parent = this.state.files[parentId];
      if (parent.type === "folder") {
        parent.children = parent.children || [];
        parent.children.push(id);
        parent.modifiedAt = Date.now();
      }
    } else {
      this.state.rootFiles.push(id);
    }

    this.saveToStorage();
    return file;
  }

  // Internal async version that waits for storage to complete
  private async createFileInternal(name: string, parentId?: string, extension = "sol"): Promise<FileNode> {
    const id = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[FILE SYSTEM] Creating file: ${name} with ID: ${id}`);
    
    const file: FileNode = {
      id,
      name,
      type: "file",
      extension,
      parentId,
      content: this.getDefaultContent(extension),
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };

    this.state.files[id] = file;

    if (parentId && this.state.files[parentId]) {
      const parent = this.state.files[parentId];
      if (parent.type === "folder") {
        parent.children = parent.children || [];
        parent.children.push(id);
        parent.modifiedAt = Date.now();
      }
    } else {
      this.state.rootFiles.push(id);
    }

    await this.saveToStorage();
    console.log(`[FILE SYSTEM] File created and saved: ${name} (${id})`);
    return file;
  }

  // Async version for MCP interface
  async createFileAsync(name: string, parentId?: string, extension = "sol"): Promise<FileNode> {
    await this.ensureInitialized();
    return this.createFileInternal(name, parentId, extension);
  }

  // Async version for updating file content
  async updateFileAsync(id: string, content: string): Promise<void> {
    await this.ensureInitialized();
    console.log(`[FILE SYSTEM] Updating file content for ID: ${id}`);
    
    if (this.state.files[id] && this.state.files[id].type === "file") {
      this.state.files[id].content = content;
      this.state.files[id].modifiedAt = Date.now();
      await this.saveToStorage();
      console.log(`[FILE SYSTEM] File content updated and saved: ${id}`);
    } else {
      console.warn(`[FILE SYSTEM] File not found or not a file: ${id}`);
    }
  }

  // Expose ensureInitialized for external use
  public async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  createFolder(name: string, parentId?: string): FileNode {
    const id = `folder-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const folder: FileNode = {
      id,
      name,
      type: "folder",
      children: [],
      parentId,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };

    this.state.files[id] = folder;

    if (parentId && this.state.files[parentId]) {
      const parent = this.state.files[parentId];
      if (parent.type === "folder") {
        parent.children = parent.children || [];
        parent.children.push(id);
        parent.modifiedAt = Date.now();
      }
    } else {
      this.state.rootFiles.push(id);
    }

    this.saveToStorage();
    return folder;
  }

  updateFile(id: string, content: string): void {
    if (this.state.files[id] && this.state.files[id].type === "file") {
      this.state.files[id].content = content;
      this.state.files[id].modifiedAt = Date.now();
      this.saveToStorage();
    }
  }

  deleteFile(id: string): void {
    const file = this.state.files[id];
    if (!file) return;

    // Remove from parent's children or root files
    if (file.parentId && this.state.files[file.parentId]) {
      const parent = this.state.files[file.parentId];
      if (parent.children) {
        parent.children = parent.children.filter((childId) => childId !== id);
        parent.modifiedAt = Date.now();
      }
    } else {
      this.state.rootFiles = this.state.rootFiles.filter(
        (fileId) => fileId !== id
      );
    }

    // If it's a folder, recursively delete children
    if (file.type === "folder" && file.children) {
      file.children.forEach((childId) => this.deleteFile(childId));
    }

    delete this.state.files[id];
    this.saveToStorage();
  }

  renameFile(id: string, newName: string): void {
    if (this.state.files[id]) {
      this.state.files[id].name = newName;
      this.state.files[id].modifiedAt = Date.now();
      this.saveToStorage();
    }
  }

  moveFile(fileId: string, newParentId?: string): boolean {
    const file = this.state.files[fileId];
    if (!file) return false;

    // Can't move a folder into itself or its descendants
    if (file.type === "folder" && newParentId) {
      if (this.isDescendant(newParentId, fileId)) {
        return false;
      }
    }

    // Remove from current parent
    if (file.parentId && this.state.files[file.parentId]) {
      const currentParent = this.state.files[file.parentId];
      if (currentParent.children) {
        currentParent.children = currentParent.children.filter(
          (childId) => childId !== fileId
        );
        currentParent.modifiedAt = Date.now();
      }
    } else {
      // Remove from root files
      this.state.rootFiles = this.state.rootFiles.filter((id) => id !== fileId);
    }

    // Add to new parent
    if (newParentId && this.state.files[newParentId]) {
      const newParent = this.state.files[newParentId];
      if (newParent.type === "folder") {
        newParent.children = newParent.children || [];
        newParent.children.push(fileId);
        newParent.modifiedAt = Date.now();
        file.parentId = newParentId;
      } else {
        return false; // Can't move into a file
      }
    } else {
      // Move to root
      this.state.rootFiles.push(fileId);
      file.parentId = undefined;
    }

    file.modifiedAt = Date.now();
    this.saveToStorage();
    return true;
  }

  private isDescendant(
    potentialDescendantId: string,
    ancestorId: string
  ): boolean {
    const potentialDescendant = this.state.files[potentialDescendantId];
    if (!potentialDescendant) return false;

    if (potentialDescendant.parentId === ancestorId) return true;
    if (potentialDescendant.parentId) {
      return this.isDescendant(potentialDescendant.parentId, ancestorId);
    }
    return false;
  }

  getFile(id: string): FileNode | undefined {
    return this.state.files[id];
  }

  getAllFiles(): Record<string, FileNode> {
    return this.state.files;
  }

  getRootFiles(): string[] {
    return this.state.rootFiles;
  }

  getFileTree(): FileTreeNode[] {
    return this.state.rootFiles
      .map((id) => this.buildFileTree(id))
      .filter(Boolean) as FileTreeNode[];
  }

  private buildFileTree(id: string): FileTreeNode | null {
    const file = this.state.files[id];
    if (!file) return null;

    if (file.type === "folder" && file.children) {
      const { children, ...fileWithoutChildren } = file;
      return {
        ...fileWithoutChildren,
        children: children
          .map((childId) => this.buildFileTree(childId))
          .filter(Boolean) as FileTreeNode[],
      };
    }

    const { children, ...fileWithoutChildren } = file;
    return fileWithoutChildren;
  }

  private getDefaultContent(extension: string): string {
    switch (extension) {
      case "sol":
        return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MyContract {
    // Your contract code here
}`;
      case "js":
        return `// JavaScript file
console.log('Hello, World!');`;
      default:
        return "";
    }
  }

  // Search functionality
  searchFiles(query: string): FileNode[] {
    const results: FileNode[] = [];
    const searchTerm = query.toLowerCase();

    Object.values(this.state.files).forEach((file) => {
      if (
        file.name.toLowerCase().includes(searchTerm) ||
        (file.content && file.content.toLowerCase().includes(searchTerm))
      ) {
        results.push(file);
      }
    });

    return results;
  }
}

// Export singleton instance
export const fileSystem = FileSystem.getInstance();
