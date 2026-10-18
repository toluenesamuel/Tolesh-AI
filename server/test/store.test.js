/** Store unit tests — in-memory SQLite, no I/O. */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';

describe('store', () => {
  let store;
  beforeEach(() => {
    store = createStore(':memory:');
  });

  test('creates a conversation with a UUID and defaults', () => {
    const conv = store.createConversation();
    assert.match(conv.id, /^[0-9a-f-]{36}$/);
    assert.equal(conv.title, 'New conversation');
    assert.deepEqual(conv.messages, []);
  });

  test('addMessage persists and orders messages', () => {
    const conv = store.createConversation('t');
    store.addMessage(conv.id, 'user', 'hello');
    store.addMessage(conv.id, 'assistant', 'hi');
    const got = store.getConversation(conv.id);
    assert.equal(got.messages.length, 2);
    assert.equal(got.messages[0].role, 'user');
    assert.equal(got.messages[0].content, 'hello');
    assert.equal(got.messages[1].role, 'assistant');
    assert.equal(got.messages[1].content, 'hi');
  });

  test('listConversations sorts by most recently updated', () => {
    const a = store.createConversation('first');
    const b = store.createConversation('second');
    store.addMessage(a.id, 'user', 'bump');
    const list = store.listConversations();
    assert.equal(list[0].id, a.id);
    assert.equal(list[1].id, b.id);
  });

  test('deleteConversation removes messages and conversation', () => {
    const conv = store.createConversation();
    store.addMessage(conv.id, 'user', 'x');
    assert.equal(store.deleteConversation(conv.id), true);
    assert.equal(store.getConversation(conv.id), null);
    assert.equal(store.deleteConversation(conv.id), false);
  });

  test('getConversation returns null for unknown id', () => {
    assert.equal(store.getConversation('nope'), null);
  });
});
