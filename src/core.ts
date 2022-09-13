/* eslint-disable prefer-const */
import { BigInt, BigDecimal, store, log } from "@graphprotocol/graph-ts";
import {
  Pair,
  Token,
  Bundle,
} from "../generated/schema";
import { Mint, Burn, Swap, Transfer, Sync } from "../generated/templates/Pair/Pair";
import { deriveUSDPrice, getTrackedVolumeUSD, getTrackedLiquidityUSD, getEthPriceInUSD, getBZZPriceInUSD } from "./pricing";
import { convertTokenToDecimal, ADDRESS_ZERO, FACTORY_ADDRESS, ONE_BI, ZERO_BD, BI_18 } from "./utils";

export function handleSync(event: Sync): void {
  let pair = Pair.load(event.address.toHex());
  if (!pair) {
    log.debug("sync event, but pair doesn't exist: {}", [event.address.toHex()])
    return
  }

  let token0 = Token.load(pair.token0);
  if (!token0) {
    log.debug("sync event, but token0 doesn't exist: {}", [pair.token0])
    return
  }

  let token1 = Token.load(pair.token1);
  if (!token1) {
    log.debug("sync event, but token1 doesn't exist: {}", [pair.token1])
    return
  }

  const ethPrice = getEthPriceInUSD();
  const bzzPrice = getBZZPriceInUSD();

  // update ETH price now that reserves could have changed
  let bundle = Bundle.load('1')
  if (!bundle) {
    log.debug("sync event, but Bundle doesn't exist: {}", ["1"])
    return
  }
  
  bundle.ethPrice = ethPrice
  bundle.bzzPrice = bzzPrice
  bundle.save()

  // reset token total liquidity amounts
  // if this is the first SYNC event for this pair
  // then both reserves are 0 and this operation doesnt have an effect
  token0.totalLiquidity = token0.totalLiquidity.minus(pair.reserve0);
  token1.totalLiquidity = token1.totalLiquidity.minus(pair.reserve1);

  // TODO: make constant
   // what if at first we had reserve0LiquidityUSD, and after the current event processing it disappears (in the condition below)
   // - what is it, we will have the old reserve0LiquidityUSD hanging?
   // check that the pair has prices for usd tokens
   // if they are not defined, it makes no sense to subtract the previous trackedTotalLiquidity - after all, it did not exist before
  if (pair.reserve0LiquidityUSD.gt(ZERO_BD) && pair.reserve1LiquidityUSD.gt(ZERO_BD)) {
    token0.trackedTotalLiquidity = token0.trackedTotalLiquidity.minus(pair.reserve0)
    token0.trackedTotalLiquidityUSD = token0.trackedTotalLiquidityUSD.minus(pair.reserve0LiquidityUSD)

    token1.trackedTotalLiquidity = token1.trackedTotalLiquidity.minus(pair.reserve1)
    token1.trackedTotalLiquidityUSD = token1.trackedTotalLiquidityUSD.minus(pair.reserve1LiquidityUSD)
  }


  // updating pair reserves
  const reserve0 = convertTokenToDecimal(event.params.reserve0, token0.decimals);
  const reserve1 = convertTokenToDecimal(event.params.reserve1, token1.decimals);

  pair.reserve0 = reserve0;
  pair.reserve1 = reserve1;

  token0.totalLiquidity = token0.totalLiquidity.plus(reserve0);
  token1.totalLiquidity = token1.totalLiquidity.plus(reserve1);

  pair.token0Price = reserve1.notEqual(ZERO_BD) ? reserve0.div(reserve1) : ZERO_BD;
  pair.token1Price = reserve0.notEqual(ZERO_BD) ? reserve1.div(reserve0) : ZERO_BD;


  // if (pair.id == "0x8e50d726e2ea87a27fa94760d4e65d58c3ad8b44") {
  //   log.warning("[sync] usdt-usdc reserve0={} reserve1={} raw_reserve0={} raw_reserve1={} token0.decimals={} token1.decimals={}", [
  //     reserve0.toString(),
  //     reserve1.toString(),
  //     event.params.reserve0.toString(),
  //     event.params.reserve1.toString(),
  //     token0.decimals.toString(),
  //     token1.decimals.toString(),
  //   ])
  // }

  const deriveResponse = deriveUSDPrice(reserve0, reserve1, token0, token1)
  const token0UsdPrice = deriveResponse.token0PriceUsd; 
  const token1UsdPrice = deriveResponse.token1PriceUsd;
  const token0ethPrice = ethPrice.notEqual(ZERO_BD) ? token0UsdPrice.div(ethPrice) : ZERO_BD;
  const token1ethPrice = ethPrice.notEqual(ZERO_BD) ? token1UsdPrice.div(ethPrice) : ZERO_BD;
  const token0bzzPrice = bzzPrice.notEqual(ZERO_BD) ? token0UsdPrice.div(bzzPrice) : ZERO_BD;
  const token1bzzPrice = bzzPrice.notEqual(ZERO_BD) ? token1UsdPrice.div(bzzPrice) : ZERO_BD;

  // if (pair.id == "0x8e50d726e2ea87a27fa94760d4e65d58c3ad8b44") {
  //   log.warning("[sync] usdt-usdc raw_reserve0={} raw_reserve1={} token0.decimals={} token1.decimals={}", [
  //     event.params.reserve0.toString(),
  //     event.params.reserve1.toString(),
  //     token0.decimals.toString(),
  //     token1.decimals.toString(),
  //   ])
  // }

  if (token0UsdPrice.gt(ZERO_BD) && token1UsdPrice.gt(ZERO_BD)) {
    log.info(
      "Pair new usd prices: pair={} token0UsdPrice={} token1UsdPrice={}", 
      [pair.id, token0UsdPrice.toString(),  token1UsdPrice.toString()]      
    )

    pair.reserve0LiquidityUSD = pair.reserve0.times(token0UsdPrice)
    pair.reserve1LiquidityUSD = pair.reserve1.times(token1UsdPrice)

    token0.trackedTotalLiquidity = token0.trackedTotalLiquidity.plus(reserve0)
    token1.trackedTotalLiquidity = token1.trackedTotalLiquidity.plus(reserve1)

    log.info(
      "pair={} token0.trackedTotalLiquidity={}", 
      [pair.id, token0.trackedTotalLiquidity.toString()+" +"+reserve0.toString()]      
    )
    log.info(
      "pair={} token1.trackedTotalLiquidity={}", 
      [pair.id, token1.trackedTotalLiquidity.toString()+" +"+reserve1.toString()]      
    )

    token0.trackedTotalLiquidityUSD = token0.trackedTotalLiquidityUSD.plus(pair.reserve0LiquidityUSD)
    token1.trackedTotalLiquidityUSD = token1.trackedTotalLiquidityUSD.plus(pair.reserve1LiquidityUSD)
    token0.derivedUSD = token0UsdPrice;
    token0.derivedETH = token0ethPrice;
    token1.derivedUSD = token1UsdPrice;
    token1.derivedETH = token1ethPrice;
  } else {
    log.debug("Pair zero liqudity pair={} token0UsdPrice={} token1UsdPrice={}", [
      pair.id,
      token0UsdPrice.toString(),
      token1UsdPrice.toString()
    ])
    pair.reserve0LiquidityUSD = ZERO_BD
    pair.reserve1LiquidityUSD = ZERO_BD
    // no need to subtract liqudity from tokens, as we subtracted it at the earlier step (if it was no 0)
  }

  // get tracked liquidity
  const trackedLiquidityUSD = getTrackedLiquidityUSD(reserve0, token0, reserve1, token1);
  const trackedLiquidityETH = ethPrice.notEqual(ZERO_BD) ? trackedLiquidityUSD.div(ethPrice) : ZERO_BD;

  pair.trackedReserveUSD = trackedLiquidityUSD;
  pair.trackedReserveETH= trackedLiquidityETH;
  pair.reserveUSD = reserve0.times(token0UsdPrice)
      .plus(reserve1.times(token1UsdPrice));
  pair.reserveETH = reserve0.times(token0ethPrice)
      .plus(reserve1.times(token1ethPrice));

  // TODO: price dilation

  token0.save()
  token1.save()
  pair.save()
}

export function handleBurn(event: Burn): void {
  let pair = Pair.load(event.address.toHex());
  if (!pair) {
    log.debug("burn event, but pair doesn't exist: {}", [event.address.toHex()])
    return
  }

  // update token info
  let token0 = Token.load(pair.token0);
  if (!token0) {
    log.debug("burn event, but token0 doesn't exist: {}", [pair.token0])
    return
  }

  let token1 = Token.load(pair.token1);
  if (!token1) {
    log.debug("burn event, but token1 doesn't exist: {}", [pair.token1])
    return
  }

  let token0Amount = convertTokenToDecimal(event.params.amount0, token0.decimals);
  let token1Amount = convertTokenToDecimal(event.params.amount1, token1.decimals);

  // update txn counts
  token0.totalTransactions = token0.totalTransactions.plus(ONE_BI);
  token1.totalTransactions = token1.totalTransactions.plus(ONE_BI);

  let amountTotalUSD = token0.derivedUSD.times(token0Amount)
      .plus(token1.derivedUSD.times(token1Amount));

  // update txn counts
  pair.totalTransactions = pair.totalTransactions.plus(ONE_BI);

  // update global counter and save
  token0.save();
  token1.save();
  pair.save();
}

export function handleSwap(event: Swap): void {
  const pair = Pair.load(event.address.toHex())
  if (!pair) {
    log.debug("swap event, but pair doesn't exist: {}", [event.address.toHex()])
    return
  }

  let token0 = Token.load(pair.token0);
  if (!token0) {
    log.debug("swap event, but token0 doesn't exist: {}", [pair.token0])
    return
  }

  let token1 = Token.load(pair.token1);
  if (!token1) {
    log.debug("swap event, but token1 doesn't exist: {}", [pair.token1])
    return
  }

  const amount0In  = convertTokenToDecimal(event.params.amount0In, token0.decimals);
  const amount1In  = convertTokenToDecimal(event.params.amount1In, token1.decimals);
  const amount0Out = convertTokenToDecimal(event.params.amount0Out, token0.decimals);
  const amount1Out = convertTokenToDecimal(event.params.amount1Out, token1.decimals);

  // totals for volume updates
  let amount0Total = amount0Out.plus(amount0In);
  let amount1Total = amount1Out.plus(amount1In);

  let trackedAmountUSD = getTrackedVolumeUSD(
    amount0Total,
    token0,
    amount1Total,
    token1,
  );

  // update token0 global volume and token liquidity stats
  token0.tradeVolume = token0.tradeVolume.plus(amount0In.plus(amount0Out));
  token0.tradeVolumeUSD = token0.tradeVolumeUSD.plus(trackedAmountUSD);
  token0.totalTransactions = token0.totalTransactions.plus(ONE_BI);

  // update token1 global volume and token liquidity stats
  token1.tradeVolume = token1.tradeVolume.plus(amount1In.plus(amount1Out));
  token1.tradeVolumeUSD = token1.tradeVolumeUSD.plus(trackedAmountUSD);
  token1.totalTransactions = token1.totalTransactions.plus(ONE_BI);

  // update pair volume data, use tracked amount if we have it as its probably more accurate
  pair.volumeUSD = pair.volumeUSD.plus(trackedAmountUSD);
  pair.volumeToken0 = pair.volumeToken0.plus(amount0Total);
  pair.volumeToken1 = pair.volumeToken1.plus(amount1Total);
  pair.totalTransactions = pair.totalTransactions.plus(ONE_BI);
  pair.save();

  // save entities
  pair.save();
  token0.save();
  token1.save();
}