import { afterEach, beforeEach, describe, expect, test, } from '@jest/globals'

import { AssetRegistryError, WdkTokenAssetRegistry } from '@tetherto/wdk-asset-registry'
import commonTokens from '@tetherto/wdk-asset-registry/assets/common-tokens'

const TEST_SYMBOL = 'usdt'
const TEST_CHAINID = 'eip155:1'
const TEST_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const TEST_ID = `${TEST_CHAINID}/${TEST_ADDRESS}`
const TEST_NEW_ASSET = {
  id: 'eip155:1/0x1111111111111111111111111111111111111111',
  address: '0x1111111111111111111111111111111111111111',
  symbol: 'TEST',
  name: 'Test Token',
  decimals: 18,
  chainId: 'eip155:1',
  isNative: false
}
const TEST_REPLACED_ASSET = {
  id: TEST_ID,
  address: TEST_ADDRESS,
  symbol: 'USDT',
  name: 'Tether USD Updated',
  decimals: 6,
  chainId: 'eip155:1',
  isNative: false
}
const TEST_EXTRA_ASSET = {
  id: 'eip155:10/0x3333333333333333333333333333333333333333',
  address: '0x3333333333333333333333333333333333333333',
  symbol: 'EXTRA',
  name: 'Extra Token',
  decimals: 18,
  chainId: 'eip155:10',
  isNative: false
}

describe('wallet-token-asset-registry', () => {
  let wdkAssetRegistry

  beforeEach(() => {
    wdkAssetRegistry = new WdkTokenAssetRegistry(structuredClone(commonTokens))
  })

  afterEach(() => {
    wdkAssetRegistry = undefined
  })

  test('should load all common assets from the package export', () => {
    const assets = wdkAssetRegistry.getTokens()

    expect(assets.length).toBeGreaterThan(0)
  })

  test('should load Berachain USDT0 at its deployed address', () => {
    const asset = wdkAssetRegistry.getTokenById(
      'eip155:80094/0x779Ded0c9e1022225f8E0630b35a9b54bE713736'
    )

    expect(asset).toEqual(expect.objectContaining({
      symbol: 'USDT0',
      chainId: 'eip155:80094',
      address: '0x779Ded0c9e1022225f8E0630b35a9b54bE713736'
    }))
  })

  test('should allow multiple asset sets in the constructor', () => {
    const registry = new WdkTokenAssetRegistry(
      structuredClone(commonTokens),
      [TEST_EXTRA_ASSET]
    )

    const assets = registry.getTokens()
    const [extraAsset] = registry.getTokenBySymbol(TEST_EXTRA_ASSET.symbol, {
      caseSensitive: false
    })

    expect(assets.length).toBe(commonTokens.length + 1)
    expect(extraAsset).toEqual(TEST_EXTRA_ASSET)
  })

  test('should get tokens by symbol', () => {
    const assets = wdkAssetRegistry.getTokenBySymbol(TEST_SYMBOL)

    expect(assets.length).toBeGreaterThan(0)

    for (const asset of assets) {
      expect(asset.symbol.toLowerCase()).toBe(TEST_SYMBOL)
    }
  })

  test('should support case sensitive symbol lookup', () => {
    expect(wdkAssetRegistry.getTokenBySymbol('USDT', { caseSensitive: true }).length).toBeGreaterThan(0)
    expect(wdkAssetRegistry.getTokenBySymbol(TEST_SYMBOL, { caseSensitive: true })).toEqual([])
  })

  test('should get a token by id', () => {
    const asset = wdkAssetRegistry.getTokenById(TEST_ID)

    expect(asset).toEqual(expect.objectContaining({ id: TEST_ID, address: TEST_ADDRESS }))
  })

  test('should get tokens by address', () => {
    const assets = wdkAssetRegistry.getTokenByAddress(TEST_ADDRESS)

    expect(assets.length).toBeGreaterThan(0)

    const [asset] = assets

    expect(asset.symbol.toLowerCase()).toBe(TEST_SYMBOL)
    expect(asset.address).toBe(TEST_ADDRESS)
  })

  test('should match address case-sensitively by default', () => {
    expect(wdkAssetRegistry.getTokenByAddress(TEST_ADDRESS).length).toBeGreaterThan(0)
    expect(wdkAssetRegistry.getTokenByAddress(TEST_ADDRESS.toLowerCase())).toEqual([])
  })

  test('should support case insensitive address lookup when opted out', () => {
    const exact = wdkAssetRegistry.getTokenByAddress(TEST_ADDRESS, { caseSensitive: false })
    const lowerCased = wdkAssetRegistry.getTokenByAddress(TEST_ADDRESS.toLowerCase(), { caseSensitive: false })

    expect(exact.length).toBeGreaterThan(0)
    expect(lowerCased).toEqual(exact)
  })

  test('should get tokens by chain', () => {
    const assets = wdkAssetRegistry.getTokenByChain(TEST_CHAINID)

    expect(assets.length).toBeGreaterThan(0)

    for (const asset of assets) {
      expect(asset.chainId).toBe(TEST_CHAINID)
    }
  })

  test('should register a new asset', () => {
    const initialLength = wdkAssetRegistry.getTokens().length

    wdkAssetRegistry.registerAsset(TEST_NEW_ASSET)
    const asset = wdkAssetRegistry.getTokenById(TEST_NEW_ASSET.id)

    expect(wdkAssetRegistry.getTokens()).toHaveLength(initialLength + 1)
    expect(asset).toEqual(TEST_NEW_ASSET)
  })

  test('should throw when registering a duplicate asset without upsert', () => {
    expect(() => wdkAssetRegistry.registerAsset(TEST_REPLACED_ASSET)).toThrow(AssetRegistryError)
    expect(() => wdkAssetRegistry.registerAsset(TEST_REPLACED_ASSET)).toThrow(
      'Asset already exists. Set upsert to `true` to replace it.'
    )
  })

  test('should replace an existing asset when upsert is true', () => {
    wdkAssetRegistry.registerAsset(TEST_REPLACED_ASSET, true)
    const asset = wdkAssetRegistry.getTokenById(TEST_ID)

    expect(asset.name).toBe(TEST_REPLACED_ASSET.name)
  })

  test('should register multiple assets', () => {
    const assetsToRegister = [
      TEST_NEW_ASSET,
      {
        ...TEST_NEW_ASSET,
        id: 'eip155:1/0x2222222222222222222222222222222222222222',
        address: '0x2222222222222222222222222222222222222222',
        symbol: 'TEST2',
        name: 'Test Token 2'
      }
    ]

    wdkAssetRegistry.registerAssets(assetsToRegister)

    expect(wdkAssetRegistry.getTokenById(assetsToRegister[0].id)).toEqual(assetsToRegister[0])
    expect(wdkAssetRegistry.getTokenById(assetsToRegister[1].id)).toEqual(assetsToRegister[1])
  })

  test('should replace multiple existing assets when upsert is true', () => {
    const assetsToReplace = [
      TEST_REPLACED_ASSET,
      {
        id: 'eip155:42161/0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
        address: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
        symbol: 'USDT',
        name: 'Tether USD Arbitrum Updated',
        decimals: 6,
        chainId: 'eip155:42161',
        isNative: false
      }
    ]

    wdkAssetRegistry.registerAssets(assetsToReplace, true)

    expect(wdkAssetRegistry.getTokenById(TEST_ID).name).toBe(TEST_REPLACED_ASSET.name)
    expect(wdkAssetRegistry.getTokenById(assetsToReplace[1].id).name).toBe(assetsToReplace[1].name)
  })
})
