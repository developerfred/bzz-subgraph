# Bzz.Exchange Subgraph

- [The Graph Docs](https://thegraph.com/docs/en/)

## Gnosis Safe

- [Contract MultiSign](https://gnosis-safe.io/app/eth:0xF38BaBE8ec33E6f254f2dFe586d4108f9768f3a4)
- [Owner](https://etherscan.io/address/0xeeC58E89996496640c8b5898A7e0218E9b6E90cB)

### NFT Subgraph

    - [Bzz.Exchange NFT](https://rainbow.me/0xF38BaBE8ec33E6f254f2dFe586d4108f9768f3a4?nft=ethereum_0x24e36639b3a3aaa9c928a8a6f12d34f942f1ab67_64849270923382455341852465775920526013424461330368521678295672647035734567474) 

## How To use

### INSTALL GRAPH CLI

```
npm install -g @graphprotocol/graph-cli

yarn global add @graphprotocol/graph-cli

```

You can install Graph CLI with either npm or yarn.

**Note: You need version 0.21.0 or above**

## Deploy

Authenticate within the CLI, build and deploy your subgraph to the Studio.

### AUTHENTICATE IN CLI

```
graph auth --studio 
```

### ENTER SUBGRAPH

```
cd bzzaar
```

### BUILD SUBGRAPH

```
graph codegen && graph build
```

### DEPLOY SUBGRAPH

```
graph deploy --studio bzzaar
```

- [Maintainer Developer: @codingsh](github.com/developerfred) | [codingsh grants](https://gitcoin.co/grants/646/gitcoinblockchain-developer-grant-codingsh)
