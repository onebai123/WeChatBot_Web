/**
 * AppData 结构完整性属性测试
 * **Feature: unified-data-layer, Property 1: AppData 结构完整性**
 * **Feature: unified-data-layer, Property 2: ID 类型一致性**
 * **Validates: Requirements 1.2, 1.3, 7.1**
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { AppData, CoreMemoryV2 } from './appData'
import { CURRENT_VERSION } from './appData'
import { DEFAULT_APP_DATA } from '@/lib/defaults'
import type { Persona, EmojiItem } from './index'

// ============ 生成器 ============

/** 生成有效的 Persona */
const personaArb = fc.record({
  id: fc.string({ minLength: 1 }),
  name: fc.string({ minLength: 1 }),
  content: fc.string(),
  messages: fc.array(fc.record({
    id: fc.string({ minLength: 1 }),
    text: fc.string(),
    inversion: fc.boolean(),
    dateTime: fc.string(),
    error: fc.boolean(),
  })),
  isDefault: fc.option(fc.boolean(), { nil: undefined }),
  avatar: fc.option(fc.string(), { nil: undefined }),
  pinned: fc.option(fc.boolean(), { nil: undefined }),
  lastMessageTime: fc.option(fc.string(), { nil: undefined }),
}) as fc.Arbitrary<Persona>

/** 生成有效的 CoreMemoryV2 */
const coreMemoryArb = fc.record({
  id: fc.string({ minLength: 1 }),
  personaId: fc.string({ minLength: 1 }),
  content: fc.string(),
  importance: fc.integer({ min: 1, max: 5 }),
  createdAt: fc.string(),
  category: fc.constantFrom('user_info', 'event', 'preference', 'other'),
}) as fc.Arbitrary<CoreMemoryV2>

/** 生成有效的 EmojiItem */
const emojiItemArb = fc.record({
  id: fc.string({ minLength: 1 }),
  name: fc.string(),
  url: fc.string(),
  category: fc.string(),
  createdAt: fc.string(),
}) as fc.Arbitrary<EmojiItem>

/** 生成有效的 AppData */
const appDataArb = fc.record({
  version: fc.constant(CURRENT_VERSION),
  lastUpdated: fc.string(),
  personas: fc.array(personaArb, { minLength: 0, maxLength: 5 }),
  activePersonaId: fc.option(fc.string(), { nil: null }),
  config: fc.record({
    api: fc.record({ apiKey: fc.string(), apiBaseUrl: fc.string() }),
    gpt: fc.record({
      model: fc.string(),
      maxTokens: fc.integer({ min: 100, max: 10000 }),
      systemMessage: fc.string(),
      temperature: fc.float({ min: 0, max: 2 }),
      topP: fc.float({ min: 0, max: 1 }),
      talkCount: fc.integer({ min: 1, max: 100 }),
      autoMemoryOrganize: fc.boolean(),
      memoryOrganizeCount: fc.integer({ min: 5, max: 50 }),
    }),
    user: fc.record({
      avatar: fc.string(),
      aiAvatar: fc.string(),
      name: fc.string(),
      backgroundImage: fc.option(fc.string(), { nil: undefined }),
    }),
    autoMessage: fc.record({
      enabled: fc.boolean(),
      minInterval: fc.integer({ min: 1, max: 1000 }),
      maxInterval: fc.integer({ min: 1, max: 1000 }),
      prompt: fc.string(),
    }),
    quietTime: fc.record({
      enabled: fc.boolean(),
      startTime: fc.string(),
      endTime: fc.string(),
    }),
    vision: fc.record({
      enabled: fc.boolean(),
      apiKey: fc.string(),
      apiBaseUrl: fc.string(),
      model: fc.string(),
    }),
    onlineSearch: fc.record({
      enabled: fc.boolean(),
      apiKey: fc.string(),
      apiBaseUrl: fc.string(),
      model: fc.string(),
      searchPrompt: fc.string(),
    }),
    emoji: fc.record({
      enabled: fc.boolean(),
      probability: fc.integer({ min: 0, max: 100 }),
    }),
    phoneMode: fc.boolean(),
  }),
  memories: fc.record({
    core: fc.array(coreMemoryArb, { maxLength: 10 }),
    temp: fc.dictionary(fc.string(), fc.record({
      personaId: fc.string(),
      logs: fc.array(fc.record({
        timestamp: fc.string(),
        role: fc.constantFrom('user', 'ai'),
        content: fc.string(),
      })),
      lastUpdated: fc.string(),
    })),
  }),
  theme: fc.string(),
  customEmojis: fc.array(emojiItemArb, { maxLength: 5 }),
}) as fc.Arbitrary<AppData>

// ============ 测试 ============

describe('AppData 结构完整性', () => {
  /**
   * Property 1: AppData 结构完整性
   * *For any* AppData object, it SHALL contain all required fields
   */
  it('Property 1: 任意 AppData 应包含所有必需字段', () => {
    fc.assert(
      fc.property(appDataArb, (data: AppData) => {
        // 验证顶层字段存在
        expect(data).toHaveProperty('version')
        expect(data).toHaveProperty('lastUpdated')
        expect(data).toHaveProperty('personas')
        expect(data).toHaveProperty('activePersonaId')
        expect(data).toHaveProperty('config')
        expect(data).toHaveProperty('memories')
        expect(data).toHaveProperty('theme')
        expect(data).toHaveProperty('customEmojis')
        
        // 验证类型
        expect(typeof data.version).toBe('string')
        expect(typeof data.lastUpdated).toBe('string')
        expect(Array.isArray(data.personas)).toBe(true)
        expect(data.activePersonaId === null || typeof data.activePersonaId === 'string').toBe(true)
        expect(typeof data.config).toBe('object')
        expect(typeof data.memories).toBe('object')
        expect(typeof data.theme).toBe('string')
        expect(Array.isArray(data.customEmojis)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 2: ID 类型一致性
   * *For any* entity (Persona, CoreMemory, EmojiItem), its id field SHALL be of type string
   */
  it('Property 2: 所有实体 ID 应为 string 类型', () => {
    fc.assert(
      fc.property(appDataArb, (data: AppData) => {
        // 验证 Persona ID
        data.personas.forEach((persona) => {
          expect(typeof persona.id).toBe('string')
          expect(persona.id.length).toBeGreaterThan(0)
        })
        
        // 验证 CoreMemory personaId
        data.memories.core.forEach((memory) => {
          expect(typeof memory.id).toBe('string')
          expect(typeof memory.personaId).toBe('string')
          expect(memory.id.length).toBeGreaterThan(0)
          expect(memory.personaId.length).toBeGreaterThan(0)
        })
        
        // 验证 EmojiItem ID
        data.customEmojis.forEach((emoji) => {
          expect(typeof emoji.id).toBe('string')
          expect(emoji.id.length).toBeGreaterThan(0)
        })
      }),
      { numRuns: 100 }
    )
  })

  it('DEFAULT_APP_DATA 应符合 AppData 结构', () => {
    const data = DEFAULT_APP_DATA
    
    expect(data.version).toBe(CURRENT_VERSION)
    expect(typeof data.lastUpdated).toBe('string')
    expect(Array.isArray(data.personas)).toBe(true)
    expect(data.activePersonaId).toBeNull()
    expect(data.config).toBeDefined()
    expect(data.memories).toBeDefined()
    expect(data.theme).toBe('wechat')
    expect(Array.isArray(data.customEmojis)).toBe(true)
  })
})
