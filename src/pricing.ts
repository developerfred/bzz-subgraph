/* eslint-disable prefer-const */
import { BigDecimal, Address } from "@graphprotocol/graph-ts/index";
import { Pair, Token } from "../generated/schema";
import { ZERO_BD, factoryContract, ADDRESS_ZERO, ONE_BD } from "./utils";


const WETH_ADDRESS = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
const USDC_WETH_PAIR = '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc' // created 10008355
const DAI_WETH_PAIR = '0xa478c2975ab1ea89e8196811f51a7b7ade33eb11' // created block 10042267
const USDT_WETH_PAIR = '0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852' // created block 10093341
const DAI_BZZ_PAIR = '0x145eAE953C4C2d43fAEac7CcD08F5b906981CCF1' // created block 12693850

const STABLE_COIN_ADDRESSES = [DAI_WETH_PAIR, USDC_WETH_PAIR, USDT_WETH_PAIR]

// от балды 
const MIN_USD_LIQUIDITY = BigDecimal.fromString("20000")

const WHITELIST: string[] = [
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
  '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
  '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
  '0x0000000000085d4780b73119b644ae5ecd22b376', // TUSD
  '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643', // cDAI
  '0x39aa39c021dfbae8fac545936693ac917d5e7563', // cUSDC
  '0x86fadb80d8d2cff3c3680819e4da99c10232ba0f', // EBASE
  '0x57ab1ec28d129707052df4df418d58a2d46d5f51', // sUSD
  '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2', // MKR
  '0xc00e94cb662c3520282e6f5717214004a7f26888', // COMP
  '0x514910771af9ca656af840dff83e8264ecf986ca', //LINK
  '0x960b236a07cf122663c4303350609a66a7b288c0', //ANT
  '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f', //SNX
  '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e', //YFI
  '0xdf5e0e81dff6faf3a7e52ba697820c5e32d806a8', // yCurv
  '0x853d955acef822db058eb8505911ed77f175b99e', // FRAX
  '0xa47c8bf37f92abed4a126bda807a7b7498661acd', // WUST
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', // UNI
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC
  "0x19062190B1925b5b6689D7073fDfC8c2976EF8Cb", // BZZ
];

export function getEthPriceInUSD(): BigDecimal {
  const usdtPair = Pair.load(USDC_WETH_PAIR); // usdt is token0
  if (usdtPair !== null) {
    return usdtPair.token0Price;
  } else {
    return ZERO_BD;
  }
}

export function getBZZPriceInUSD(): BigDecimal {
  const bzzPair = Pair.load(DAI_BZZ_PAIR);
  if (bzzPair !== null) {
    return bzzPair.token0Price;
  } else {
    return ZERO_BD;
  }
}

export function deriveUSDPrice(
  reserve0: BigDecimal,
  reserve1: BigDecimal,
  token0: Token,
  token1: Token,
): DeriveUSDPriceResponse {
  if (STABLE_COIN_ADDRESSES.includes(token0.id)) {
    const token0PriceUsd = BigDecimal.fromString("1.0")
    const token1PriceUsd = _deriveUsdPrice(reserve0, reserve1)

    return {token0PriceUsd, token1PriceUsd}
  }
  
  if (STABLE_COIN_ADDRESSES.includes(token1.id)) {
    const token0PriceUsd = _deriveUsdPrice(reserve1, reserve0)
    const token1PriceUsd = BigDecimal.fromString("1.0")

    return {token0PriceUsd, token1PriceUsd}
  } 
  
  // TODO: what if someone creates a SHIT/USDT pair and puts 10**9 SHIT and 1 USDT into it? It doesn't mean the same
  // that we suddenly have a shield coin with billion USD liquidity! just the same, its liquidity is $1
  // therefore, it is more correct to calculate the liquidity of the token not based on the price, but on the basis of liquidity
  // currency counter (always a stable coin), and the liquidity of pairs of two shieldcoins is calculated based on the presence of this particular coin
  // real liquidity.

  // if both tokens are already priced, then we need to find weighted liquidity based on the price ratio in this pair
  // i.e. Let's say both tokens cost $1, and if you divide the reserves, then it turns out that token0 costs 0.95 and token1 costs 1.05
  // therefore, it is necessary to multiply the trackedTotalLiquidityUSD of the 0th token by 0.95, and the 1st by 1.05
  // and after determining the weighted trackedTotalLiquidityUSD, prices should be determined again
  // but this should only be done after the naive price detection is debugged
  
  if (token0.trackedTotalLiquidityUSD.gt(MIN_USD_LIQUIDITY)) {
    // Token price calculated excluding the reserves of the current pair and assuming that there is a totalLiquidityUSD
    const token0PriceUsd = token0.trackedTotalLiquidityUSD.div(token0.trackedTotalLiquidity)
    const token1PriceUsd = token0PriceUsd.times(reserve0.div(reserve1))

    return {token0PriceUsd, token1PriceUsd}
  } 
  
  if (token1.trackedTotalLiquidityUSD.gt(MIN_USD_LIQUIDITY)) {
    const token1PriceUsd = token1.trackedTotalLiquidityUSD.div(token1.trackedTotalLiquidity)
    const token0PriceUsd = token1PriceUsd.div(reserve0.div(reserve1))

    return {token0PriceUsd, token1PriceUsd}
  }

  return {token0PriceUsd: ZERO_BD, token1PriceUsd: ZERO_BD}
}

class DeriveUSDPriceResponse {
 token0PriceUsd: BigDecimal;
 token1PriceUsd: BigDecimal;
};

function _deriveUsdPrice(usdReserves: BigDecimal, baseReserves: BigDecimal): BigDecimal {
  return usdReserves.div(baseReserves)
}

export function getTrackedVolumeUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let price0 = token0.derivedUSD;
  let price1 = token1.derivedUSD;

  // both tokens have non-zero price
  if (price0.gt(ZERO_BD) && price1.gt(ZERO_BD)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1)).div(BigDecimal.fromString("2"));
  }

  // only first token has usd-derived price
  if (price0.gt(ZERO_BD)) {
    return tokenAmount0.times(price0);
  }

  // only second token has usd price
  if (price1.gt(ZERO_BD)) {
    return tokenAmount1.times(price1);
  }

  // neither token has derived price
  return ZERO_BD;
}

export function getTrackedLiquidityUSD(
    tokenAmount0: BigDecimal,
    token0: Token,
    tokenAmount1: BigDecimal,
    token1: Token
): BigDecimal {
  let price0 = token0.derivedUSD;
  let price1 = token1.derivedUSD;

  // both are priced tokens, take average of both amounts
  if (price0.gt(ZERO_BD) && price1.gt(ZERO_BD)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1));
  }

  // take double value of the priced token amount
  if (price0.gt(ZERO_BD)) {
    return tokenAmount0.times(price0).times(BigDecimal.fromString("2"));
  }

  // take double value of the priced token amount
  if (price1.gt(ZERO_BD)) {
    return tokenAmount1.times(price1).times(BigDecimal.fromString("2"));
  }

  // neither token has price, tracked volume is 0
  return ZERO_BD;
}