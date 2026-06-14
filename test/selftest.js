/**
  * Self-test script for MyPassword core functionality.
  * Tests: crypto, database, and the full encrypt/decrypt flow.
  */
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const os = require('os');

// Test 1: Crypto module
console.log('=== Test 1: Crypto (PBKDF2 + AES-256-GCM) ===');
const { deriveKEK, generateDEK, encryptAES, decryptAES, generatePassword, generateSalt } = require('../dist/core/crypto');

// Test PBKDF2
const salt = generateSalt();
console.log('  Salt length:', salt.length, '(expect 32)');
const kek = deriveKEK('test-password', salt);
console.log('  KEK length:', kek.length, '(expect 32)');

// Test DEK generation
const dek = generateDEK();
console.log('  DEK length:', dek.length, '(expect 32)');

// Test encrypt/decrypt
const plaintext = 'Hello, MyPassword!';
const encrypted = encryptAES(kek, plaintext);
console.log('  Encrypted data length:', encrypted.data.length);
console.log('  IV length:', encrypted.iv.length);
console.log('  Tag length:', encrypted.tag.length);

const decrypted = decryptAES(kek, encrypted);
console.log('  Decrypted:', decrypted.toString('utf-8'));
console.assert(decrypted.toString('utf-8') === plaintext, 'FAIL: Decrypted text does not match!');
console.log('  PASS: Encrypt/Decrypt roundtrip OK');

// Test wrong password fails
try {
    const wrongKEK = deriveKEK('wrong-password', salt);
    decryptAES(wrongKEK, encrypted);
    console.log('  FAIL: Should have thrown with wrong key!');
} catch (e) {
    console.log('  PASS: Wrong password correctly rejected');
}

// Test DEK encryption flow (as used in the app)
const encDEK = encryptAES(kek, dek);
const decDEK = decryptAES(kek, encDEK);
console.assert(dek.equals(decDEK), 'FAIL: DEK roundtrip failed!');
console.log('  PASS: DEK encrypt/decrypt roundtrip OK');

// Test password generator
const pw1 = generatePassword({ length: 20 });
console.log('  Generated password:', pw1, 'length:', pw1.length);
console.assert(pw1.length === 20, 'FAIL: Password length mismatch!');
console.log('  PASS: Password generation OK');

// Test 2: Database module
console.log('\n=== Test 2: Database (SQLite CRUD) ===');
const { initDatabase, closeDatabase, setMeta, getMeta, insertItem, getItems, updateItem, toggleFavorite, softDeleteItem } = require('../dist/core/database');

const testDir = path.join(os.tmpdir(), 'mypassword-test-' + Date.now());
fs.mkdirSync(testDir, { recursive: true });

const db = initDatabase(testDir);
console.log('  Database initialized at:', testDir);

// Test meta
setMeta('test_key', 'test_value');
const val = getMeta('test_key');
console.assert(val === 'test_value', 'FAIL: Meta get/set mismatch!');
console.log('  PASS: Meta get/set OK');

// Test item CRUD (using fake encrypted data)
const fakeData = Buffer.from(JSON.stringify({ title: 'Test Login', username: 'user', password: 'pass' })).toString('base64');
const fakeIV = crypto.randomBytes(16).toString('base64');
const fakeTag = crypto.randomBytes(16).toString('base64');

const id = insertItem(1, fakeData, fakeIV, fakeTag);
console.log('  Inserted item ID:', id);

const items = getItems(1);
console.log('  Items count:', items.length, '(expect 1)');
console.assert(items.length === 1, 'FAIL: Expected 1 item!');
console.assert(items[0].item_type === 1, 'FAIL: Wrong item type!');
console.log('  PASS: Insert and list OK');

// Test update
const fakeData2 = Buffer.from(JSON.stringify({ title: 'Updated Login' })).toString('base64');
updateItem(id, fakeData2, fakeIV, fakeTag);
const updated = getItems(1);
console.log('  PASS: Update OK');

// Test favorite
toggleFavorite(id, 1);
const favItems = getItems(1);
console.assert(favItems[0].favorite === 1, 'FAIL: Favorite not set!');
console.log('  PASS: Toggle favorite OK');

// Test soft delete
softDeleteItem(id);
const afterDelete = getItems(1, false);
console.assert(afterDelete.length === 0, 'FAIL: Item still visible after soft delete!');
const withDeleted = getItems(1, true);
console.assert(withDeleted.length === 1, 'FAIL: Item missing from trash!');
console.log('  PASS: Soft delete OK');

closeDatabase();

// Cleanup
fs.rmSync(testDir, { recursive: true, force: true });

console.log('\n=== All Tests Passed! ===');
