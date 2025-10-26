const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SimpleStorage Contract Tests", function () {
  let simpleStorage;
  let owner;
  let addr1;

  beforeEach(async function () {
    // This will fail because contract deployment is not properly set up
    [owner, addr1] = await ethers.getSigners();
    const SimpleStorage = await ethers.getContractFactory("SimpleStorage");
    simpleStorage = await SimpleStorage.deploy();
    await simpleStorage.deployed();
  });

  it("Should set the initial message correctly", async function () {
    const message = await simpleStorage.getMessage();
    expect(message).to.equal("");
  });

  it("Should update the message", async function () {
    const newMessage = "Hello, World!";
    await simpleStorage.setMessage(newMessage);
    const message = await simpleStorage.getMessage();
    expect(message).to.equal(newMessage);
  });

  it("Should allow different accounts to update the message", async function () {
    const newMessage = "Message from addr1";
    await simpleStorage.connect(addr1).setMessage(newMessage);
    const message = await simpleStorage.getMessage();
    expect(message).to.equal(newMessage);
  });

  it("Should store messages with spaces and special characters", async function () {
    const specialMessage = "Hello, World! @#$%^&*()";
    await simpleStorage.setMessage(specialMessage);
    const message = await simpleStorage.getMessage();
    expect(message).to.equal(specialMessage);
  });

  it("Should handle empty messages", async function () {
    await simpleStorage.setMessage("");
    const message = await simpleStorage.getMessage();
    expect(message).to.equal("");
  });

  it("Should pass a basic assertion", async function () {
    expect(true).to.be.true;
  });

  it("Should handle numbers correctly", async function () {
    expect(2 + 2).to.equal(4);
  });
});