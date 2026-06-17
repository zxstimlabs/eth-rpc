/**
 * Curated token lists — the PRICED subset of the catalog, per chain.
 * ----------------------------------------------------------------
 * Auto-generated. Each entry is a token that appears in our curated source
 * list for that chain AND has market data in the `/tokens` top-500 catalog
 * (i.e. a price is available). Identity (symbol/name) comes from the curated
 * source list; `decimals` and `coingeckoId` come from the catalog's
 * `deployments` (CoinGecko `detail_platforms`, authoritative). Sorted by
 * market-cap rank. Addresses are lowercased — checksum with viem `getAddress`
 * if needed.
 *
 * Sources: ethereum ← uniswap-token-list.json (chain 1, incl. bridged),
 * arbitrum ← arbitrum-token-list.json, base ← base-token-list.json.
 *
 * Use on the frontend as the fixed token set: read balances via RPC using
 * these addresses/decimals, then fetch prices from `/tokens`. Tokens not in
 * this list have no price.
 */

import type { UmCuratedToken } from "../types/um-curated-token";

export const ethereumTokens: UmCuratedToken[] = [
  {
    "chainId": 1,
    "address": "0xdac17f958d2ee523a2206206994597c13d831ec7",
    "symbol": "USDT",
    "name": "Tether USD",
    "decimals": 6,
    "logoURI": "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png",
    "coingeckoId": "tether"
  },
  {
    "chainId": 1,
    "address": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    "symbol": "USDC",
    "name": "USDCoin",
    "decimals": 6,
    "logoURI": "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png",
    "coingeckoId": "usd-coin"
  },
  {
    "chainId": 1,
    "address": "0xdc035d45d973e3ec169d2276ddab16f1e407384f",
    "symbol": "USDS",
    "name": "USDS Stablecoin",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/39926/large/usds.webp?1726666683",
    "coingeckoId": "usds"
  },
  {
    "chainId": 1,
    "address": "0x925206b8a707096ed26ae47c84747fe0bb734f59",
    "symbol": "WBT",
    "name": "WhiteBIT Coin",
    "decimals": 8,
    "logoURI": "https://coin-images.coingecko.com/coins/images/27045/large/wbt_token.png?1696526096",
    "coingeckoId": "whitebit"
  },
  {
    "chainId": 1,
    "address": "0x514910771af9ca656af840dff83e8264ecf986ca",
    "symbol": "LINK",
    "name": "ChainLink Token",
    "decimals": 18,
    "logoURI": "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x514910771AF9Ca656af840dff83E8264EcF986CA/logo.png",
    "coingeckoId": "chainlink"
  },
  {
    "chainId": 1,
    "address": "0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d",
    "symbol": "USD1",
    "name": "World Liberty Financial USD",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/54977/large/USD1_1000x1000_transparent.png?1749297002",
    "coingeckoId": "usd1-wlfi"
  },
  {
    "chainId": 1,
    "address": "0x6b175474e89094c44da98b954eedeac495271d0f",
    "symbol": "DAI",
    "name": "Dai Stablecoin",
    "decimals": 18,
    "logoURI": "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png",
    "coingeckoId": "dai"
  },
  {
    "chainId": 1,
    "address": "0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce",
    "symbol": "SHIB",
    "name": "Shiba Inu",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/11939/thumb/shiba.png?1622619446",
    "coingeckoId": "shiba-inu"
  },
  {
    "chainId": 1,
    "address": "0x6c3ea9036406852006290770bedfcaba0e23a0e8",
    "symbol": "PYUSD",
    "name": "PayPal USD",
    "decimals": 6,
    "logoURI": "https://assets.coingecko.com/coins/images/31212/large/PYUSD_Logo_%282%29.png?1691458314",
    "coingeckoId": "paypal-usd"
  },
  {
    "chainId": 1,
    "address": "0xe343167631d89b6ffc58b88d6b7fb0228795491d",
    "symbol": "USDG",
    "name": "Global Dollar",
    "decimals": 6,
    "logoURI": "https://assets.coingecko.com/coins/images/51281/large/GDN_USDG_Token_200x200.png",
    "coingeckoId": "global-dollar"
  },
  {
    "chainId": 1,
    "address": "0xa0b73e1ff0b80914ab6fe0444e65848c4c34450b",
    "symbol": "CRO",
    "name": "Cronos",
    "decimals": 8,
    "logoURI": "https://assets.coingecko.com/coins/images/7310/thumb/oCw2s3GI_400x400.jpeg?1645172042",
    "coingeckoId": "crypto-com-chain"
  },
  {
    "chainId": 1,
    "address": "0x68749665ff8d2d112fa859aa293f07a622782f38",
    "symbol": "XAUT",
    "name": "Tether Gold",
    "decimals": 6,
    "logoURI": "https://coin-images.coingecko.com/coins/images/10481/large/Tether_Gold.png?1696510471",
    "coingeckoId": "tether-gold"
  },
  {
    "chainId": 1,
    "address": "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
    "symbol": "UNI",
    "name": "Uniswap",
    "decimals": 18,
    "logoURI": "ipfs://QmXttGpZrECX5qCyXbBQiqgQNytVGeZW5Anewvh2jc4psg",
    "coingeckoId": "uniswap"
  },
  {
    "chainId": 1,
    "address": "0x45804880de22913dafe09f4980848ece6ecbaf78",
    "symbol": "PAXG",
    "name": "PAX Gold",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/9519/thumb/paxg.PNG?1568542565",
    "coingeckoId": "pax-gold"
  },
  {
    "chainId": 1,
    "address": "0xda5e1988097297dcdc1f90d4dfe7909e847cbef6",
    "symbol": "WLFI",
    "name": "World Liberty Financial",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/50767/large/wlfi.png?1756438915",
    "coingeckoId": "world-liberty-financial"
  },
  {
    "chainId": 1,
    "address": "0x3c3a81e81dc49a522a592e7622a7e711c06bf354",
    "symbol": "MNT",
    "name": "Mantle",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/30980/large/Mantle-Logo-mark.png?1739213200",
    "coingeckoId": "mantle"
  },
  {
    "chainId": 1,
    "address": "0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3",
    "symbol": "ONDO",
    "name": "Ondo Finance",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/26580/standard/ONDO.png?1696525656",
    "coingeckoId": "ondo-finance"
  },
  {
    "chainId": 1,
    "address": "0x8292bb45bf1ee4d140127049757c2e0ff06317ed",
    "symbol": "RLUSD",
    "name": "RLUSD",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/39651/large/RLUSD_200x200_(1).png?1727376633",
    "coingeckoId": "ripple-usd"
  },
  {
    "chainId": 1,
    "address": "0x75231f58b43240c9718dd58b4967c5114342a86c",
    "symbol": "OKB",
    "name": "OKB",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/4463/large/WeChat_Image_20220118095654.png?1696505053",
    "coingeckoId": "okb"
  },
  {
    "chainId": 1,
    "address": "0x56072c95faa701256059aa122697b133aded9279",
    "symbol": "SKY",
    "name": "SKY Governance Token",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/39925/large/sky.jpg?1724827980",
    "coingeckoId": "sky"
  },
  {
    "chainId": 1,
    "address": "0x6982508145454ce325ddbe47a25d4ec3d2311933",
    "symbol": "PEPE",
    "name": "Pepe",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/29850/large/pepe-token.jpeg?1682922725",
    "coingeckoId": "pepe"
  },
  {
    "chainId": 1,
    "address": "0x58d97b57bb95320f9a05dc918aef65434969c2b2",
    "symbol": "MORPHO",
    "name": "Morpho Token",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/29837/large/Morpho-token-icon.png?1726771230",
    "coingeckoId": "morpho"
  },
  {
    "chainId": 1,
    "address": "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9",
    "symbol": "AAVE",
    "name": "Aave",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/12645/thumb/AAVE.png?1601374110",
    "coingeckoId": "aave"
  },
  {
    "chainId": 1,
    "address": "0x4a220e6096b25eadb88358cb44068a3248254675",
    "symbol": "QNT",
    "name": "Quant",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/3370/thumb/5ZOu7brX_400x400.jpg?1612437252",
    "coingeckoId": "quant-network"
  },
  {
    "chainId": 1,
    "address": "0x6de037ef9ad2725eb40118bb1702ebb27e4aeb24",
    "symbol": "RNDR",
    "name": "Render Token",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/11636/thumb/rndr.png?1638840934",
    "coingeckoId": "render-token"
  },
  {
    "chainId": 1,
    "address": "0x455e53cbb86018ac2b8092fdcd39d8444affc3f6",
    "symbol": "POL",
    "name": "Polygon Ecosystem Token",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/32440/large/polygon.png?1698233684",
    "coingeckoId": "polygon-ecosystem-token"
  },
  {
    "chainId": 1,
    "address": "0x57e114b691db790c35207b2e685d4a43181e6061",
    "symbol": "ENA",
    "name": "Ethena",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/36530/standard/ethena.png",
    "coingeckoId": "ethena"
  },
  {
    "chainId": 1,
    "address": "0xe28b3b32b6c345a34ff64674606124dd5aceca30",
    "symbol": "INJ",
    "name": "Injective",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/12882/thumb/Secondary_Symbol.png?1628233237",
    "coingeckoId": "injective-protocol"
  },
  {
    "chainId": 1,
    "address": "0xb50721bcf8d664c30412cfbc6cf7a15145234ad1",
    "symbol": "ARB",
    "name": "Arbitrum",
    "decimals": 18,
    "logoURI": "https://arbitrum.foundation/logo.png",
    "coingeckoId": "arbitrum"
  },
  {
    "chainId": 1,
    "address": "0x8b1484d57abbe239bb280661377363b03c89caea",
    "symbol": "ADI",
    "name": "ADI",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/68846/large/ADI_Token-min.png?1765296433",
    "coingeckoId": "adi-token"
  },
  {
    "chainId": 1,
    "address": "0xaea46a60368a7bd060eec7df8cba43b7ef41ad85",
    "symbol": "FET",
    "name": "Fetch ai",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/5681/thumb/Fetch.jpg?1572098136",
    "coingeckoId": "fetch-ai"
  },
  {
    "chainId": 1,
    "address": "0x152649ea73beab28c5b49b26eb48f7ead6d4c898",
    "symbol": "CAKE",
    "name": "PancakeSwap",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/12632/large/pancakeswap-cake-logo_%281%29.png?1696512440",
    "coingeckoId": "pancakeswap-token"
  },
  {
    "chainId": 1,
    "address": "0x1abaea1f7c830bd89acc67ec4af516284b1bc33c",
    "symbol": "EURC",
    "name": "Euro Coin",
    "decimals": 6,
    "logoURI": "https://assets.coingecko.com/coins/images/26045/thumb/euro-coin.png?1655394420",
    "coingeckoId": "euro-coin"
  },
  {
    "chainId": 1,
    "address": "0x904567252d8f48555b7447c67dca23f0372e16be",
    "symbol": "KITE",
    "name": "Kite",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/70426/large/KITE-ICON.png?1762328605",
    "coingeckoId": "kite-2"
  },
  {
    "chainId": 1,
    "address": "0xe0f63a424a4439cbe457d80e4f4b51ad25b2c56c",
    "symbol": "SPX",
    "name": "SPX6900",
    "decimals": 8,
    "logoURI": "https://coin-images.coingecko.com/coins/images/31401/large/sticker_(1).jpg?1702371083",
    "coingeckoId": "spx6900"
  },
  {
    "chainId": 1,
    "address": "0x232ce3bd40fcd6f80f3d55a522d03f25df784ee2",
    "symbol": "LIT",
    "name": "Lighter",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/71121/large/lighter.png?1765888098",
    "coingeckoId": "lighter"
  },
  {
    "chainId": 1,
    "address": "0x44ff8620b8ca30902395a7bd3f2407e1a091bf73",
    "symbol": "VIRTUAL",
    "name": "Virtuals Protocol",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/34057/large/LOGOMARK.png?1708356054",
    "coingeckoId": "virtual-protocol"
  },
  {
    "chainId": 1,
    "address": "0x98a878b1cd98131b271883b390f68d2c90674665",
    "symbol": "APXUSD",
    "name": "apxUSD",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/102172243/large/apxUSD.png?1772448502",
    "coingeckoId": "apxusd"
  },
  {
    "chainId": 1,
    "address": "0xd533a949740bb3306d119cc777fa900ba034cd52",
    "symbol": "CRV",
    "name": "Curve DAO Token",
    "decimals": 18,
    "logoURI": "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xD533a949740bb3306d119CC777fa900bA034cd52/logo.png",
    "coingeckoId": "curve-dao-token"
  },
  {
    "chainId": 1,
    "address": "0xfe0c30065b384f05761f15d0cc899d4f9f9cc0eb",
    "symbol": "ETHFI",
    "name": "Ether.fi",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/35958/standard/etherfi.jpeg",
    "coingeckoId": "ether-fi"
  },
  {
    "chainId": 1,
    "address": "0x6810e776880c02933d47db1b9fc05908e5386b96",
    "symbol": "GNO",
    "name": "Gnosis Token",
    "decimals": 18,
    "logoURI": "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6810e776880C02933D47DB1b9fc05908e5386b96/logo.png",
    "coingeckoId": "gnosis"
  },
  {
    "chainId": 1,
    "address": "0x6985884c4392d348587b19cb9eaaf157f13271cd",
    "symbol": "ZRO",
    "name": "LayerZero",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/28206/standard/ftxG9_TJ_400x400.jpeg?1696527208",
    "coingeckoId": "layerzero"
  },
  {
    "chainId": 1,
    "address": "0xcf0c122c6b73ff809c693db761e7baebe62b6a2e",
    "symbol": "FLOKI",
    "name": "FLOKI",
    "decimals": 9,
    "logoURI": "https://assets.coingecko.com/coins/images/16746/standard/PNG_image.png?1696516318",
    "coingeckoId": "floki"
  },
  {
    "chainId": 1,
    "address": "0x2798b1cc5a993085e8a9d46e80499f1b63f42204",
    "symbol": "GWEI",
    "name": "ETHGas",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/71375/large/ethgas_token_200.png?1769055039",
    "coingeckoId": "ethgas-2"
  },
  {
    "chainId": 1,
    "address": "0x3506424f91fd33084466f402d5d97f05f8e3b4af",
    "symbol": "CHZ",
    "name": "Chiliz",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/8834/thumb/Chiliz.png?1561970540",
    "coingeckoId": "chiliz"
  },
  {
    "chainId": 1,
    "address": "0x808507121b80c02388fad14726482e061b8da827",
    "symbol": "PENDLE",
    "name": "Pendle",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/15069/large/Pendle_Logo_Normal-03.png?1696514728",
    "coingeckoId": "pendle"
  },
  {
    "chainId": 1,
    "address": "0x7420b4b9a0110cdc71fb720908340c03f9bc03ec",
    "symbol": "JASMY",
    "name": "JasmyCoin",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/13876/thumb/JASMY200x200.jpg?1612473259",
    "coingeckoId": "jasmycoin"
  },
  {
    "chainId": 1,
    "address": "0x467bccd9d29f223bce8043b84e8c8b282827790f",
    "symbol": "TEL",
    "name": "Telcoin",
    "decimals": 2,
    "logoURI": "https://coin-images.coingecko.com/coins/images/1899/large/tel.png?1696502892",
    "coingeckoId": "telcoin"
  },
  {
    "chainId": 1,
    "address": "0x5a98fcbea516cf06857215779fd812ca3bef1b32",
    "symbol": "LDO",
    "name": "Lido DAO",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/13573/thumb/Lido_DAO.png?1609873644",
    "coingeckoId": "lido-dao"
  },
  {
    "chainId": 1,
    "address": "0x853d955acef822db058eb8505911ed77f175b99e",
    "symbol": "FRAX",
    "name": "Frax",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/13422/thumb/frax_logo.png?1608476506",
    "coingeckoId": "frax"
  },
  {
    "chainId": 1,
    "address": "0xca14007eff0db1f8135f4c25b34de49ab0d42766",
    "symbol": "STRK",
    "name": "Starknet",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/26433/standard/starknet.png?1696525507",
    "coingeckoId": "starknet"
  },
  {
    "chainId": 1,
    "address": "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72",
    "symbol": "ENS",
    "name": "Ethereum Name Service",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/19785/thumb/acatxTm8_400x400.jpg?1635850140",
    "coingeckoId": "ethereum-name-service"
  },
  {
    "chainId": 1,
    "address": "0xc944e90c64b2c07662a292be6244bdf05cda44a7",
    "symbol": "GRT",
    "name": "The Graph",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/13397/thumb/Graph_Token.png?1608145566",
    "coingeckoId": "the-graph"
  },
  {
    "chainId": 1,
    "address": "0xf57d49646621f563b0b905afc8336923ac569ec5",
    "symbol": "NEX",
    "name": "Nexus",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/102173233/large/nexus.jpg?1778490588",
    "coingeckoId": "nexus-4"
  },
  {
    "chainId": 1,
    "address": "0xbb0e17ef65f82ab018d8edd776e8dd940327b28b",
    "symbol": "AXS",
    "name": "Axie Infinity",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/13029/thumb/axie_infinity_logo.png?1604471082",
    "coingeckoId": "axie-infinity"
  },
  {
    "chainId": 1,
    "address": "0xc00e94cb662c3520282e6f5717214004a7f26888",
    "symbol": "COMP",
    "name": "Compound",
    "decimals": 18,
    "logoURI": "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xc00e94Cb662C3520282E6f5717214004A7f26888/logo.png",
    "coingeckoId": "compound-governance-token"
  },
  {
    "chainId": 1,
    "address": "0x643c4e15d7d62ad0abec4a9bd4b001aa3ef52d66",
    "symbol": "SYRUP",
    "name": "Syrup Token",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/51232/standard/IMG_7420.png?1730831572",
    "coingeckoId": "syrup"
  },
  {
    "chainId": 1,
    "address": "0xb1110919016846972056ab995054d65560d5f05e",
    "symbol": "BILL",
    "name": "Billions",
    "decimals": 18,
    "logoURI": "https://s2.coinmarketcap.com/static/img/coins/64x64/39545.png",
    "coingeckoId": "billions-network"
  },
  {
    "chainId": 1,
    "address": "0xa2cd3d43c775978a96bdbf12d733d5a1ed94fb18",
    "symbol": "XCN",
    "name": "Chain",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/24210/thumb/Chain_icon_200x200.png?1646895054",
    "coingeckoId": "chain-2"
  },
  {
    "chainId": 1,
    "address": "0xaa7a9ca87d3694b5755f213b5d04094b8d0f0a6f",
    "symbol": "TRAC",
    "name": "OriginTrail",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/1877/thumb/TRAC.jpg?1635134367",
    "coingeckoId": "origintrail"
  },
  {
    "chainId": 1,
    "address": "0xec53bf9167f50cdeb3ae105f56099aaab9061f83",
    "symbol": "EIGEN",
    "name": "EigenLayer",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/37441/large/eigen.jpg?1728023974",
    "coingeckoId": "eigenlayer"
  },
  {
    "chainId": 1,
    "address": "0x3845badade8e6dff049820680d1f14bd3903a5d0",
    "symbol": "SAND",
    "name": "The Sandbox",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/12129/thumb/sandbox_logo.jpg?1597397942",
    "coingeckoId": "the-sandbox"
  },
  {
    "chainId": 1,
    "address": "0x0d8775f648430679a709e98d2b0cb6250d2887ef",
    "symbol": "BAT",
    "name": "Basic Attention Token",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/677/thumb/basic-attention-token.png?1547034427",
    "coingeckoId": "basic-attention-token"
  },
  {
    "chainId": 1,
    "address": "0x56a3ba04e95d34268a19b2a4474dc979babdaf76",
    "symbol": "SENT",
    "name": "Sentient",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/70508/large/SENTIENT-Icon-BlushForce-L.png?1762267532",
    "coingeckoId": "sentient"
  },
  {
    "chainId": 1,
    "address": "0x0f5d2fb29fb7d3cfee444a200298f468908cc942",
    "symbol": "MANA",
    "name": "Decentraland",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/878/thumb/decentraland-mana.png?1550108745",
    "coingeckoId": "decentraland"
  },
  {
    "chainId": 1,
    "address": "0xb0076de78dc50581770bba1d211ddc0ad4f2a241",
    "symbol": "EDGEX",
    "name": "EDGEX",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/markets/images/11726/large/Logo_White_-_Black_BG.png?1727920571",
    "coingeckoId": "edgex"
  },
  {
    "chainId": 1,
    "address": "0xd1d2eb1b1e90b638588728b4130137d262c87cae",
    "symbol": "GALA",
    "name": "GALA",
    "decimals": 8,
    "logoURI": "https://assets.coingecko.com/coins/images/12493/standard/GALA-COINGECKO.png?1696512310",
    "coingeckoId": "gala"
  },
  {
    "chainId": 1,
    "address": "0x4d224452801aced8b2f0aebe155379bb5d594381",
    "symbol": "APE",
    "name": "ApeCoin",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/24383/small/apecoin.jpg?1647476455",
    "coingeckoId": "apecoin"
  },
  {
    "chainId": 1,
    "address": "0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b",
    "symbol": "CVX",
    "name": "Convex Finance",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/15585/thumb/convex.png?1621256328",
    "coingeckoId": "convex-finance"
  },
  {
    "chainId": 1,
    "address": "0xf57e7e7c23978c3caec3c3548e3d615c346e79ff",
    "symbol": "IMX",
    "name": "Immutable X",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/17233/thumb/imx.png?1636691817",
    "coingeckoId": "immutable-x"
  },
  {
    "chainId": 1,
    "address": "0x7dd9c5cba05e151c895fde1cf355c9a1d5da6429",
    "symbol": "GLM",
    "name": "Golem",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/542/thumb/Golem_Submark_Positive_RGB.png?1606392013",
    "coingeckoId": "golem"
  },
  {
    "chainId": 1,
    "address": "0x111111111117dc0aa78b770fa6a738034120c302",
    "symbol": "1INCH",
    "name": "1inch",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/13469/thumb/1inch-token.png?1608803028",
    "coingeckoId": "1inch"
  },
  {
    "chainId": 1,
    "address": "0xbe0ed4138121ecfc5c0e56b40517da27e6c5226b",
    "symbol": "ATH",
    "name": "Aethir Token",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/36179/large/logogram_circle_dark_green_vb_green_(1).png?1718232706",
    "coingeckoId": "aethir"
  },
  {
    "chainId": 1,
    "address": "0xb1d1eae60eea9525032a6dcb4c1ce336a1de71be",
    "symbol": "DRV",
    "name": "Derive",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/52889/large/Token_Logo.png?1734601695",
    "coingeckoId": "derive"
  },
  {
    "chainId": 1,
    "address": "0xdef1ca1fb7fbcdc777520aa7f396b4e015f497ab",
    "symbol": "COW",
    "name": "CoW Protocol",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/24384/large/CoW-token_logo.png?1719524382",
    "coingeckoId": "cow-protocol"
  },
  {
    "chainId": 1,
    "address": "0x58b6a8a3302369daec383334672404ee733ab239",
    "symbol": "LPT",
    "name": "Livepeer",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/7137/thumb/logo-circle-green.png?1619593365",
    "coingeckoId": "livepeer"
  },
  {
    "chainId": 1,
    "address": "0x6e2a43be0b1d33b726f0ca3b8de60b3482b8b050",
    "symbol": "ARKM",
    "name": "Arkham",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/30929/standard/Arkham_Logo_CG.png?1696529771",
    "coingeckoId": "arkham"
  },
  {
    "chainId": 1,
    "address": "0x320623b8e4ff03373931769a31fc52a4e78b5d70",
    "symbol": "RSR",
    "name": "Reserve Rights",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/8365/large/RSR_Blue_Circle_1000.png?1721777856",
    "coingeckoId": "reserve-rights-token"
  },
  {
    "chainId": 1,
    "address": "0xcccccccccc33d538dbc2ee4feab0a7a1ff4e8a94",
    "symbol": "CFG",
    "name": "Centrifuge",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/55913/large/centrifuge.jpg?1747707741",
    "coingeckoId": "centrifuge-2"
  },
  {
    "chainId": 1,
    "address": "0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f",
    "symbol": "SNX",
    "name": "Synthetix Network Token",
    "decimals": 18,
    "logoURI": "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F/logo.png",
    "coingeckoId": "havven"
  },
  {
    "chainId": 1,
    "address": "0x8408d45b61f5823298f19a09b53b7339c0280489",
    "symbol": "ALLO",
    "name": "Allora",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/70609/large/allo-token.png?1763451165",
    "coingeckoId": "allora"
  },
  {
    "chainId": 1,
    "address": "0x62d0a8458ed7719fdaf978fe5929c6d342b0bfce",
    "symbol": "BEAM",
    "name": "Beam",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/32417/standard/chain-logo.png?1698114384",
    "coingeckoId": "beam-2"
  },
  {
    "chainId": 1,
    "address": "0x1789e0043623282d5dcc7f213d703c6d8bafbb04",
    "symbol": "LINEA",
    "name": "Linea",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/68507/large/linea-logo.jpeg?1756025484",
    "coingeckoId": "linea"
  },
  {
    "chainId": 1,
    "address": "0xe41d2489571d322189246dafa5ebde1f4699f498",
    "symbol": "ZRX",
    "name": "0x Protocol Token",
    "decimals": 18,
    "logoURI": "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xE41d2489571d322189246DaFA5ebDe1F4699F498/logo.png",
    "coingeckoId": "0x"
  },
  {
    "chainId": 1,
    "address": "0x626e8036deb333b408be468f951bdb42433cbf18",
    "symbol": "AIOZ",
    "name": "AIOZ Network",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/14631/thumb/aioz_logo.png?1617413126",
    "coingeckoId": "aioz-network"
  },
  {
    "chainId": 1,
    "address": "0xa12cc123ba206d4031d1c7f6223d1c2ec249f4f3",
    "symbol": "ZAMA",
    "name": "Zama",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/70921/large/zama.png?1764591992",
    "coingeckoId": "zama"
  },
  {
    "chainId": 1,
    "address": "0x5afe3855358e112b5647b952709e6165e1c1eeee",
    "symbol": "SAFE",
    "name": "Safe",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/27032/standard/Artboard_1_copy_8circle-1.png?1696526084",
    "coingeckoId": "safe"
  },
  {
    "chainId": 1,
    "address": "0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e",
    "symbol": "YFI",
    "name": "yearn finance",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/11849/thumb/yfi-192x192.png?1598325330",
    "coingeckoId": "yearn-finance"
  },
  {
    "chainId": 1,
    "address": "0x228bec415ade4b61d7caf0adf8c91eac587ba369",
    "symbol": "TRIA",
    "name": "Tria",
    "decimals": 18,
    "logoURI": "https://s2.coinmarketcap.com/static/img/coins/64x64/39382.png",
    "coingeckoId": "tria"
  },
  {
    "chainId": 1,
    "address": "0xcb1592591996765ec0efc1f92599a19767ee5ffa",
    "symbol": "BIO",
    "name": "BIO",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/53022/large/bio.jpg?1735011002",
    "coingeckoId": "bio-protocol"
  },
  {
    "chainId": 1,
    "address": "0xf629cbd94d3791c9250152bd8dfbdf380e2a3b9c",
    "symbol": "ENJ",
    "name": "Enjin Coin",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/1102/thumb/enjin-coin-logo.png?1547035078",
    "coingeckoId": "enjincoin"
  },
  {
    "chainId": 1,
    "address": "0xa35923162c49cf95e6bf26623385eb431ad920d3",
    "symbol": "TURBO",
    "name": "Turbo",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/30117/large/TurboMark-QL_200.png?1708079597",
    "coingeckoId": "turbo"
  },
  {
    "chainId": 1,
    "address": "0x4c1746a800d224393fe2470c70a35717ed4ea5f1",
    "symbol": "PLUME",
    "name": "Plume",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/53623/large/plume-token.png?1736896935",
    "coingeckoId": "plume"
  },
  {
    "chainId": 1,
    "address": "0xe53ec727dbdeb9e2d5456c3be40cff031ab40a55",
    "symbol": "SUPER",
    "name": "SuperFarm",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/14040/thumb/6YPdWn6.png?1613975899",
    "coingeckoId": "superfarm"
  },
  {
    "chainId": 1,
    "address": "0x1776e1f26f98b1a5df9cd347953a26dd3cb46671",
    "symbol": "NMR",
    "name": "Numeraire",
    "decimals": 18,
    "logoURI": "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1776e1F26f98b1A5dF9cD347953a26dd3Cb46671/logo.png",
    "coingeckoId": "numeraire"
  },
  {
    "chainId": 1,
    "address": "0xc20059e0317de91738d13af027dfc4a50781b066",
    "symbol": "SPK",
    "name": "Spark",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/38637/large/Spark-Logomark-RGB.png?1744878896",
    "coingeckoId": "spark-2"
  },
  {
    "chainId": 1,
    "address": "0xf091867ec603a6628ed83d274e835539d82e9cc8",
    "symbol": "Zeta",
    "name": "Zetachain",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/26718/standard/Twitter_icon.png?1696525788",
    "coingeckoId": "zetachain"
  },
  {
    "chainId": 1,
    "address": "0x467719ad09025fcc6cf6f8311755809d45a5e5f3",
    "symbol": "AXL",
    "name": "Axelar",
    "decimals": 6,
    "logoURI": "https://assets.coingecko.com/coins/images/27277/large/V-65_xQ1_400x400.jpeg",
    "coingeckoId": "axelar"
  },
  {
    "chainId": 1,
    "address": "0xa3ee21c306a700e682abcdfe9baa6a08f3820419",
    "symbol": "CTC",
    "name": "Creditcoin",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/10569/large/Creditcoin_Symbol_dark56.png?1737796066",
    "coingeckoId": "creditcoin-2"
  },
  {
    "chainId": 1,
    "address": "0x6b3595068778dd592e39a122f4f5a5cf09c90fe2",
    "symbol": "SUSHI",
    "name": "Sushi",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/12271/thumb/512x512_Logo_no_chop.png?1606986688",
    "coingeckoId": "sushi"
  },
  {
    "chainId": 1,
    "address": "0x5283d291dbcf85356a21ba090e6db59121208b44",
    "symbol": "BLUR",
    "name": "Blur",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/28453/large/blur.png?1670745921",
    "coingeckoId": "blur"
  },
  {
    "chainId": 1,
    "address": "0xf0db65d17e30a966c2ae6a21f6bba71cea6e9754",
    "symbol": "BARD",
    "name": "Lombard",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/68404/large/bard.png?1755657543",
    "coingeckoId": "lombard-protocol"
  },
  {
    "chainId": 1,
    "address": "0x5a9610919f5e81183823a2be4bd1beb2b4da2a20",
    "symbol": "APR",
    "name": "aPriori",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/70220/large/logo-icon-Gradient.png?1761118006",
    "coingeckoId": "apriori"
  },
  {
    "chainId": 1,
    "address": "0x3073f7aaa4db83f95e9fff17424f71d4751a3073",
    "symbol": "MOVE",
    "name": "Movement",
    "decimals": 8,
    "logoURI": "https://s2.coinmarketcap.com/static/img/coins/64x64/32452.png",
    "coingeckoId": "movement"
  },
  {
    "chainId": 1,
    "address": "0x55296f69f40ea6d20e478533c15a6b08b654e758",
    "symbol": "XYO",
    "name": "XYO Network",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/4519/thumb/XYO_Network-logo.png?1547039819",
    "coingeckoId": "xyo-network"
  },
  {
    "chainId": 1,
    "address": "0xa27ec0006e59f245217ff08cd52a7e8b169e62d2",
    "symbol": "AZTEC",
    "name": "Aztec",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/70681/large/aztec.png?1763091883",
    "coingeckoId": "aztec"
  },
  {
    "chainId": 1,
    "address": "0xaaee1a9723aadb7afa2810263653a34ba2c21c7a",
    "symbol": "MOG",
    "name": "Mog Coin",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/31059/large/MOG_LOGO_200x200.png",
    "coingeckoId": "mog-coin"
  },
  {
    "chainId": 1,
    "address": "0x7c135549504245b5eae64fc0e99fa5ebabb8e35d",
    "symbol": "FIDD",
    "name": "Fidelity Digital Dollar",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/102171776/large/FIDD-Green_%28792px%29.png?1769612802",
    "coingeckoId": "fidelity-digital-dollar"
  },
  {
    "chainId": 1,
    "address": "0xff20817765cb7f73d4bde2e66e067e58d11095c2",
    "symbol": "AMP",
    "name": "Amp",
    "decimals": 18,
    "logoURI": "https://assets.coingecko.com/coins/images/12409/thumb/amp-200x200.png?1599625397",
    "coingeckoId": "amp-token"
  },
  {
    "chainId": 1,
    "address": "0x32b4d049fe4c888d2b92eecaf729f44df6b1f36e",
    "symbol": "ROBO",
    "name": "ROBO Token",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/102172005/large/ROBO.png?1770925648",
    "coingeckoId": "robo-token-2"
  }
];

export const arbitrumTokens: UmCuratedToken[] = [
  {
    "chainId": 42161,
    "address": "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
    "symbol": "USDC",
    "name": "USDC",
    "decimals": 6,
    "logoURI": "https://coin-images.coingecko.com/coins/images/6319/large/USDC.png?1769615602",
    "coingeckoId": "usd-coin"
  },
  {
    "chainId": 42161,
    "address": "0x6491c05a82219b8d1479057361ff1654749b876b",
    "symbol": "USDS",
    "name": "USDS",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/39926/large/usds.webp?1726666683",
    "coingeckoId": "usds"
  },
  {
    "chainId": 42161,
    "address": "0x25118290e6a5f4139381d072181157035864099d",
    "symbol": "RAIN",
    "name": "Rain",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/69134/large/Rain_logo_1_.png?1762952191",
    "coingeckoId": "rain"
  },
  {
    "chainId": 42161,
    "address": "0xf97f4df75117a78c1a5a0dbb814af92458539fb4",
    "symbol": "LINK",
    "name": "Chainlink",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/877/large/Chainlink_Logo_500.png?1760023405",
    "coingeckoId": "chainlink"
  },
  {
    "chainId": 42161,
    "address": "0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34",
    "symbol": "USDE",
    "name": "Ethena USDe",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/33613/large/usde.png?1733810059",
    "coingeckoId": "ethena-usde"
  },
  {
    "chainId": 42161,
    "address": "0x46850ad61c2b7d64d08c9c754f45254596696984",
    "symbol": "PYUSD",
    "name": "PayPal USD",
    "decimals": 6,
    "logoURI": "https://coin-images.coingecko.com/coins/images/31212/large/PYUSD_Token_Logo_2x.png?1765987788",
    "coingeckoId": "paypal-usd"
  },
  {
    "chainId": 42161,
    "address": "0xa6525ae43edcd03dc08e775774dcabd3bb925872",
    "symbol": "BUIDL",
    "name": "BlackRock USD Institutional Digital Liquidity Fund",
    "decimals": 6,
    "logoURI": "https://coin-images.coingecko.com/coins/images/36291/large/blackrock.png?1711013223",
    "coingeckoId": "blackrock-usd-institutional-digital-liquidity-fund"
  },
  {
    "chainId": 42161,
    "address": "0xfa7f8980b0f1e64a2062791cc3b0871572f1f7f0",
    "symbol": "UNI",
    "name": "Uniswap",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/12504/large/uniswap-logo.png?1720676669",
    "coingeckoId": "uniswap"
  },
  {
    "chainId": 42161,
    "address": "0x35e050d3c0ec2d29d269a8ecea763a183bdf9a9d",
    "symbol": "USDY",
    "name": "Ondo US Dollar Yield",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/31700/large/usdy_%281%29.png?1696530524",
    "coingeckoId": "ondo-us-dollar-yield"
  },
  {
    "chainId": 42161,
    "address": "0x8d010bf9c26881788b4e6bf5fd1bdc358c8f90b8",
    "symbol": "DOT",
    "name": "Polkadot",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/12171/large/polkadot.jpg?1766533446",
    "coingeckoId": "polkadot"
  },
  {
    "chainId": 42161,
    "address": "0x25d887ce7a35172c62febfd67a1856f20faebb00",
    "symbol": "PEPE",
    "name": "Pepe",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/29850/large/pepe-token.jpeg?1696528776",
    "coingeckoId": "pepe"
  },
  {
    "chainId": 42161,
    "address": "0x40bd670a58238e6e230c430bbb5ce6ec0d40df48",
    "symbol": "MORPHO",
    "name": "Morpho",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/29837/large/Morpho-token-icon.png?1726771230",
    "coingeckoId": "morpho"
  },
  {
    "chainId": 42161,
    "address": "0xba5ddd1f9d7f570dc94a51479a000e3bce967196",
    "symbol": "AAVE",
    "name": "Aave",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/12645/large/aave-token-round.png?1720472354",
    "coingeckoId": "aave"
  },
  {
    "chainId": 42161,
    "address": "0xcbeb19549054cc0a6257a77736fc78c367216ce7",
    "symbol": "EUTBL",
    "name": "Spiko EU T-Bills Money Market Fund",
    "decimals": 5,
    "logoURI": "https://coin-images.coingecko.com/coins/images/39657/large/EUTBL.png?1723517425",
    "coingeckoId": "eutbl"
  },
  {
    "chainId": 42161,
    "address": "0x58538e6a46e07434d7e7375bc268d3cb839c0133",
    "symbol": "ENA",
    "name": "Ethena",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/36530/large/ethena.png?1711701436",
    "coingeckoId": "ethena"
  },
  {
    "chainId": 42161,
    "address": "0x7dff72693f6a4149b17e7c6314655f6a9f7c8b33",
    "symbol": "GHO",
    "name": "GHO",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/30663/large/gho-token-logo.png?1720517092",
    "coingeckoId": "gho"
  },
  {
    "chainId": 42161,
    "address": "0x35f1c5cb7fb977e669fd244c567da99d8a3a6850",
    "symbol": "USD0",
    "name": "Usual USD",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/38272/large/USD0LOGO.png?1716962811",
    "coingeckoId": "usual-usd"
  },
  {
    "chainId": 42161,
    "address": "0x912ce59144191c1204e64559fe8253a0e49e6548",
    "symbol": "ARB",
    "name": "Arbitrum",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/16547/large/arb.jpg?1721358242",
    "coingeckoId": "arbitrum"
  },
  {
    "chainId": 42161,
    "address": "0x1412632f2b89e87bfa20c1318a43ced25f1d7b76",
    "symbol": "EURSAFO",
    "name": "Spiko Amundi Overnight Swap Fund (EUR)",
    "decimals": 5,
    "logoURI": "https://coin-images.coingecko.com/coins/images/102172591/large/Fund_eurSAF0.png?1774104814",
    "coingeckoId": "spiko-amundi-overnight-swap-fund-eur"
  },
  {
    "chainId": 42161,
    "address": "0x1b896893dfc86bb67cf57767298b9073d2c1ba2c",
    "symbol": "CAKE",
    "name": "PancakeSwap",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/12632/large/pancakeswap-cake-logo_%281%29.png?1696512440",
    "coingeckoId": "pancakeswap-token"
  },
  {
    "chainId": 42161,
    "address": "0x09199d9a5f4448d0848e4395d065e1ad9c4a1f74",
    "symbol": "BONK",
    "name": "Bonk",
    "decimals": 5,
    "logoURI": "https://coin-images.coingecko.com/coins/images/28600/large/bonk.jpg?1696527587",
    "coingeckoId": "bonk"
  },
  {
    "chainId": 42161,
    "address": "0x11cdb42b0eb46d95f990bedd4695a6e3fa034978",
    "symbol": "CRV",
    "name": "Curve DAO",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/12124/large/Curve.png?1696511967",
    "coingeckoId": "curve-dao-token"
  },
  {
    "chainId": 42161,
    "address": "0x93c9932e4afa59201f0b5e63f7d816516f1669fe",
    "symbol": "FDUSD",
    "name": "First Digital USD",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/31079/large/FDUSD_icon_black.png?1731097953",
    "coingeckoId": "first-digital-usd"
  },
  {
    "chainId": 42161,
    "address": "0x7189fb5b6504bbff6a852b13b7b82a3c118fdc27",
    "symbol": "ETHFI",
    "name": "Ether.fi",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/35958/large/etherfi.jpeg?1710254562",
    "coingeckoId": "ether-fi"
  },
  {
    "chainId": 42161,
    "address": "0xa0b862f60edef4452f25b4160f177db44deb6cf1",
    "symbol": "GNO",
    "name": "Gnosis",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/662/large/logo_square_simple_300px.png?1696501854",
    "coingeckoId": "gnosis"
  },
  {
    "chainId": 42161,
    "address": "0x6985884c4392d348587b19cb9eaaf157f13271cd",
    "symbol": "ZRO",
    "name": "LayerZero",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/28206/large/ftxG9_TJ_400x400.jpeg?1696527208",
    "coingeckoId": "layerzero"
  },
  {
    "chainId": 42161,
    "address": "0x0c880f6761f1af8d9aa9c466984b80dab9a8c9e8",
    "symbol": "PENDLE",
    "name": "Pendle",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/15069/large/Pendle_Logo_Normal-03.png?1696514728",
    "coingeckoId": "pendle"
  },
  {
    "chainId": 42161,
    "address": "0x0419e8bfbbb2623728c3a6129090da4ff4e48113",
    "symbol": "TEL",
    "name": "Telcoin",
    "decimals": 2,
    "logoURI": "https://coin-images.coingecko.com/coins/images/1899/large/tel.png?1696502892",
    "coingeckoId": "telcoin"
  },
  {
    "chainId": 42161,
    "address": "0x13ad51ed4f1b7e9dc168d8a00cb3f4ddd85efa60",
    "symbol": "LDO",
    "name": "Lido DAO",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/13573/large/Lido_DAO.png?1696513326",
    "coingeckoId": "lido-dao"
  },
  {
    "chainId": 42161,
    "address": "0xf0cb2dc0db5e6c66b9a70ac27b06b878da017028",
    "symbol": "OHM",
    "name": "Olympus",
    "decimals": 9,
    "logoURI": "https://coin-images.coingecko.com/coins/images/14483/large/token_OHM_%281%29.png?1696514169",
    "coingeckoId": "olympus"
  },
  {
    "chainId": 42161,
    "address": "0x17fc002b466eec40dae837fc4be5c67993ddbd6f",
    "symbol": "FRAX",
    "name": "Legacy Frax Dollar",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/13422/large/LFRAX.png?1751911193",
    "coingeckoId": "frax"
  },
  {
    "chainId": 42161,
    "address": "0x9623063377ad1b27544c965ccd7342f7ea7e88c7",
    "symbol": "GRT",
    "name": "The Graph",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/13397/large/Graph_Token.png?1696513159",
    "coingeckoId": "the-graph"
  },
  {
    "chainId": 42161,
    "address": "0x498bf2b1e120fed3ad3d42ea2165e9b73f99c1e5",
    "symbol": "CRVUSD",
    "name": "crvUSD",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/30118/large/crvusd.jpg?1746670973",
    "coingeckoId": "crvusd"
  },
  {
    "chainId": 42161,
    "address": "0x0a1a1a107e45b7ced86833863f482bc5f4ed82ef",
    "symbol": "USDAI",
    "name": "USDai",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/55857/large/USDai_Token_Full_Glyph.png?1755229050",
    "coingeckoId": "usdai"
  },
  {
    "chainId": 42161,
    "address": "0x354a6da3fcde098f8389cad84b0182725c6c91de",
    "symbol": "COMP",
    "name": "Compound",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/10775/large/COMP.png?1696510737",
    "coingeckoId": "compound-governance-token"
  },
  {
    "chainId": 42161,
    "address": "0x76ce01f0ef25aa66cc5f1e546a005e4a63b25609",
    "symbol": "REUSD",
    "name": "Re Protocol reUSD",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/66291/large/Points_Program_Group_91.png?1749676055",
    "coingeckoId": "re-protocol-reusd"
  },
  {
    "chainId": 42161,
    "address": "0x021289588cd81dc1ac87ea91e91607eef68303f5",
    "symbol": "USTBL",
    "name": "Spiko US T-Bills Money Market Fund",
    "decimals": 5,
    "logoURI": "https://coin-images.coingecko.com/coins/images/39666/large/USTB.png?1723541269",
    "coingeckoId": "spiko-us-t-bills-money-market-fund"
  },
  {
    "chainId": 42161,
    "address": "0xb4818bb69478730ef4e33cc068dd94278e2766cb",
    "symbol": "SATUSD",
    "name": "Satoshi Stablecoin",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/37760/large/Instagram_post_-_25.png?1715475306",
    "coingeckoId": "satoshi-stablecoin"
  },
  {
    "chainId": 42161,
    "address": "0x0c709396739b9cfb72bcea6ac691ce0ddf66479c",
    "symbol": "SAFO",
    "name": "Spiko Amundi Overnight Swap Fund",
    "decimals": 5,
    "logoURI": "https://coin-images.coingecko.com/coins/images/102172590/large/Fund_usdSAFO.png?1774104804",
    "coingeckoId": "safo"
  },
  {
    "chainId": 42161,
    "address": "0x00000000efe302beaa2b3e6e1b18d08d69a9012a",
    "symbol": "AUSD",
    "name": "AUSD",
    "decimals": 6,
    "logoURI": "https://coin-images.coingecko.com/coins/images/39284/large/AUSD_1024px.png?1764684132",
    "coingeckoId": "agora-dollar"
  },
  {
    "chainId": 42161,
    "address": "0x7f9fbf9bdd3f4105c478b996b648fe6e828a1e98",
    "symbol": "APE",
    "name": "ApeCoin",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/24383/large/APECOIN.png?1756551529",
    "coingeckoId": "apecoin"
  },
  {
    "chainId": 42161,
    "address": "0x6fbbbd8bfb1cd3986b1d05e7861a0f62f87db74b",
    "symbol": "VSN",
    "name": "Vision",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/67399/large/Logo-Vision-Symbol-BG-Green.png?1752676915",
    "coingeckoId": "vision-3"
  },
  {
    "chainId": 42161,
    "address": "0xfdd22ce6d1f66bc0ec89b20bf16ccb6670f55a5a",
    "symbol": "THBILL",
    "name": "Theo Short Duration US Treasury Fund",
    "decimals": 6,
    "logoURI": "https://coin-images.coingecko.com/coins/images/67650/large/thBILL.png?1753401034",
    "coingeckoId": "theo-short-duration-us-treasury-fund"
  },
  {
    "chainId": 42161,
    "address": "0x80eede496655fb9047dd39d9f418d5483ed600df",
    "symbol": "FRXUSD",
    "name": "Frax USD",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/53963/large/frxUSD.png?1737792154",
    "coingeckoId": "frax-usd"
  },
  {
    "chainId": 42161,
    "address": "0xc87b37a581ec3257b734886d9d3a581f5a9d056c",
    "symbol": "ATH",
    "name": "Aethir",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/36179/large/logogram_circle_dark_green_vb_green_%281%29.png?1718232706",
    "coingeckoId": "aethir"
  },
  {
    "chainId": 42161,
    "address": "0x77b7787a09818502305c95d68a2571f090abb135",
    "symbol": "DRV",
    "name": "Derive",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/52889/large/Token_Logo.png?1734601695",
    "coingeckoId": "derive"
  },
  {
    "chainId": 42161,
    "address": "0xcb8b5cd20bdcaea9a010ac1f8d835824f5c87a04",
    "symbol": "COW",
    "name": "CoW Protocol",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/24384/large/CoW-token_logo.png?1719524382",
    "coingeckoId": "cow-protocol"
  },
  {
    "chainId": 42161,
    "address": "0xe5e851b01dd3eda24fde709a407db44555b6d1e0",
    "symbol": "RIF",
    "name": "Rootstock Infrastructure Framework",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/7460/large/8befc44a46c247e8a3f7fc8abba586b1_%283%29.png?1705501867",
    "coingeckoId": "rif-token"
  },
  {
    "chainId": 42161,
    "address": "0x61e030a56d33e8260fdd81f03b162a79fe3449cd",
    "symbol": "FLUID",
    "name": "Fluid",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/14688/large/Logo_1_%28brighter%29.png?1734430693",
    "coingeckoId": "instadapp"
  },
  {
    "chainId": 42161,
    "address": "0x289ba1701c2f088cf0faf8b3705246331cb8a839",
    "symbol": "LPT",
    "name": "Livepeer",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/7137/large/badge-logo-circuit-green.png?1719357686",
    "coingeckoId": "livepeer"
  },
  {
    "chainId": 42161,
    "address": "0xca5ca9083702c56b481d1eec86f1776fdbd2e594",
    "symbol": "RSR",
    "name": "Reserve Rights",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/8365/large/RSR_Blue_Circle_1000.png?1721777856",
    "coingeckoId": "reserve-rights-token"
  },
  {
    "chainId": 42161,
    "address": "0x437cc33344a0b27a429f795ff6b469c72698b291",
    "symbol": "WM",
    "name": "WrappedM by M0",
    "decimals": 6,
    "logoURI": "https://coin-images.coingecko.com/coins/images/55070/large/wm.jpg?1743589588",
    "coingeckoId": "wrappedm-by-m0"
  },
  {
    "chainId": 42161,
    "address": "0x116998824ff90532906bab91becea4a8e4ce06db",
    "symbol": "EXOD",
    "name": "EXOD",
    "decimals": 8,
    "logoURI": "https://coin-images.coingecko.com/coins/images/102171773/large/exodus.png?1769612116",
    "coingeckoId": "exod"
  },
  {
    "chainId": 42161,
    "address": "0x3e76bb02286bfeaa89dd35f11253f2cbce634f91",
    "symbol": "PGOLD",
    "name": "Pleasing Gold",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/70395/large/%E9%BB%84%E9%87%91.png?1761795141",
    "coingeckoId": "pleasing-gold"
  },
  {
    "chainId": 42161,
    "address": "0x60bf4e7cf16ff34513514b968483b54beff42a81",
    "symbol": "VCNT",
    "name": "ViciCoin",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/31305/large/ViciCoin_-_small.png?1696530124",
    "coingeckoId": "vicicoin"
  },
  {
    "chainId": 42161,
    "address": "0x0c1c1c109fe34733fca54b82d7b46b75cfb71f6e",
    "symbol": "CHIP",
    "name": "USD.AI",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/102171777/large/CHIP_Token_Logo_Large.png?1776777444",
    "coingeckoId": "chip-2"
  },
  {
    "chainId": 42161,
    "address": "0x82e3a8f066a6989666b031d916c43672085b1582",
    "symbol": "YFI",
    "name": "yearn.finance",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/11849/large/yearn.jpg?1696511720",
    "coingeckoId": "yearn-finance"
  },
  {
    "chainId": 42161,
    "address": "0xfc5a1a6eb076a2c7ad06ed22c90d7e710e35ad0a",
    "symbol": "GMX",
    "name": "GMX",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/18323/large/arbit.png?1696517814",
    "coingeckoId": "gmx"
  },
  {
    "chainId": 42161,
    "address": "0xb0ffa8000886e57f86dd5264b9582b2ad87b2b91",
    "symbol": "W",
    "name": "Wormhole",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/35087/large/W_Token_%283%29.png?1758122686",
    "coingeckoId": "wormhole"
  },
  {
    "chainId": 42161,
    "address": "0x9f07f8a82cb1af1466252e505b7b7ddee103bc91",
    "symbol": "DEGEN",
    "name": "Degen",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/34515/large/android-chrome-512x512.png?1706198225",
    "coingeckoId": "degen-base"
  },
  {
    "chainId": 42161,
    "address": "0x17e1e5c6bc9ebb11647c94e1c5e3ba619f2781ea",
    "symbol": "HOT",
    "name": "Holo",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/3348/large/hot-mark-med.png?1747766692",
    "coingeckoId": "holotoken"
  },
  {
    "chainId": 42161,
    "address": "0x8ad3c73f833d3f9a523ab01476625f269aeb7cf0",
    "symbol": "TSLAX",
    "name": "Tesla xStock",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/55638/large/Ticker_TSLA__Company_Name_Tesla_Inc.__size_200x200_2x.png?1746863299",
    "coingeckoId": "tesla-xstock"
  },
  {
    "chainId": 42161,
    "address": "0x23ee2343b892b1bb63503a4fabc840e0e2c6810f",
    "symbol": "AXL",
    "name": "Axelar",
    "decimals": 6,
    "logoURI": "https://coin-images.coingecko.com/coins/images/27277/large/V-65_xQ1_400x400.jpeg?1696526329",
    "coingeckoId": "axelar"
  },
  {
    "chainId": 42161,
    "address": "0x1337420ded5adb9980cfc35f8f2b054ea86f8ab1",
    "symbol": "SQD",
    "name": "SQD",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/37869/large/New_Logo_SQD_Icon.png?1720048443",
    "coingeckoId": "subsquid"
  },
  {
    "chainId": 42161,
    "address": "0x89d59a38eb2a91df58a709bb249bf1d13ad11037",
    "symbol": "ELG",
    "name": "Escoin",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/13566/large/escoin-200.png?1696513320",
    "coingeckoId": "escoin-token"
  },
  {
    "chainId": 42161,
    "address": "0xd4d42f0b6def4ce0383636770ef773390d85c61a",
    "symbol": "SUSHI",
    "name": "Sushi",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/12271/large/512x512_Logo_no_chop.png?1696512101",
    "coingeckoId": "sushi"
  },
  {
    "chainId": 42161,
    "address": "0x6a7661795c374c0bfc635934efaddff3a7ee23b6",
    "symbol": "DOLA",
    "name": "DOLA",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/14287/large/dola.png?1696513984",
    "coingeckoId": "dola-usd"
  },
  {
    "chainId": 42161,
    "address": "0x527e8d368298dea5a53be257e5300f4dbafb7a97",
    "symbol": "LION",
    "name": "Loaded Lions",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/54686/large/_LION_Token_Artwork.png?1741015702",
    "coingeckoId": "loaded-lions"
  },
  {
    "chainId": 42161,
    "address": "0xcded6b899edba762d793f44ed295248049440e1e",
    "symbol": "FIUSD",
    "name": "Sygnum FIUSD Liquidity Fund",
    "decimals": 2,
    "logoURI": "https://coin-images.coingecko.com/coins/images/50749/large/FIUDS_200x200px_%281%29.png?1728956878",
    "coingeckoId": "sygnum-fiusd-liquidity-fund"
  },
  {
    "chainId": 42161,
    "address": "0xc1eb7689147c81ac840d4ff0d298489fc7986d52",
    "symbol": "XVS",
    "name": "Venus",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/12677/large/XVS_Token.jpg?1727454303",
    "coingeckoId": "venus"
  },
  {
    "chainId": 42161,
    "address": "0xfebded1b0986a8ee107f5ab1a1c5a813491deceb",
    "symbol": "CRCLX",
    "name": "Circle xStock",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/66918/large/CRCLx.png?1751052233",
    "coingeckoId": "circle-xstock"
  }
];

export const baseTokens: UmCuratedToken[] = [
  {
    "chainId": 8453,
    "address": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    "symbol": "USDC",
    "name": "USDC",
    "decimals": 6,
    "logoURI": "https://coin-images.coingecko.com/coins/images/6319/large/USDC.png?1769615602",
    "coingeckoId": "usd-coin"
  },
  {
    "chainId": 8453,
    "address": "0x820c137fa70c8691f0e44dc420a5e53c168921dc",
    "symbol": "USDS",
    "name": "USDS",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/39926/large/usds.webp?1726666683",
    "coingeckoId": "usds"
  },
  {
    "chainId": 8453,
    "address": "0x88fb150bdc53a65fe94dea0c9ba0a6daf8c6e196",
    "symbol": "LINK",
    "name": "Chainlink",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/877/large/Chainlink_Logo_500.png?1760023405",
    "coingeckoId": "chainlink"
  },
  {
    "chainId": 8453,
    "address": "0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34",
    "symbol": "USDE",
    "name": "Ethena USDe",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/33613/large/usde.png?1733810059",
    "coingeckoId": "ethena-usde"
  },
  {
    "chainId": 8453,
    "address": "0x8d010bf9c26881788b4e6bf5fd1bdc358c8f90b8",
    "symbol": "DOT",
    "name": "Polkadot",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/12171/large/polkadot.jpg?1766533446",
    "coingeckoId": "polkadot"
  },
  {
    "chainId": 8453,
    "address": "0x00f3c42833c3170159af4e92dbb451fb3f708917",
    "symbol": "ICP",
    "name": "Internet Computer",
    "decimals": 8,
    "logoURI": "https://coin-images.coingecko.com/coins/images/14495/large/Internet_Computer_logo.png?1696514180",
    "coingeckoId": "internet-computer"
  },
  {
    "chainId": 8453,
    "address": "0xbaa5cc21fd487b8fcc2f632f3f4e8d37262a0842",
    "symbol": "MORPHO",
    "name": "Morpho",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/29837/large/Morpho-token-icon.png?1726771230",
    "coingeckoId": "morpho"
  },
  {
    "chainId": 8453,
    "address": "0x63706e401c06ac8513145b7687a14804d17f814b",
    "symbol": "AAVE",
    "name": "Aave",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/12645/large/aave-token-round.png?1720472354",
    "coingeckoId": "aave"
  },
  {
    "chainId": 8453,
    "address": "0xa0769f7a8fc65e47de93797b4e21c073c117fc80",
    "symbol": "EUTBL",
    "name": "Spiko EU T-Bills Money Market Fund",
    "decimals": 5,
    "logoURI": "https://coin-images.coingecko.com/coins/images/39657/large/EUTBL.png?1723517425",
    "coingeckoId": "eutbl"
  },
  {
    "chainId": 8453,
    "address": "0x8c213ee79581ff4984583c6a801e5263418c4b86",
    "symbol": "JTRSY",
    "name": "Janus Henderson Anemoy Treasury Fund",
    "decimals": 6,
    "logoURI": "https://coin-images.coingecko.com/coins/images/70445/large/JTRSY.png?1762078582",
    "coingeckoId": "janus-henderson-anemoy-treasury-fund"
  },
  {
    "chainId": 8453,
    "address": "0x58538e6a46e07434d7e7375bc268d3cb839c0133",
    "symbol": "ENA",
    "name": "Ethena",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/36530/large/ethena.png?1711701436",
    "coingeckoId": "ethena"
  },
  {
    "chainId": 8453,
    "address": "0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf",
    "symbol": "VVV",
    "name": "Venice Token",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/54023/large/VVV_Token_Transparent.png?1741856877",
    "coingeckoId": "venice-token"
  },
  {
    "chainId": 8453,
    "address": "0x5a0f93d040de44e78f251b03c43be9cf317dcf64",
    "symbol": "JAAA",
    "name": "Janus Henderson Anemoy AAA CLO Fund",
    "decimals": 6,
    "logoURI": "https://coin-images.coingecko.com/coins/images/70446/large/jaaa.png?1762078666",
    "coingeckoId": "janus-henderson-anemoy-aaa-clo-fund"
  },
  {
    "chainId": 8453,
    "address": "0x6ad12e761b438bea3ea09f6c6266556bb24c2181",
    "symbol": "BDX",
    "name": "Beldex",
    "decimals": 9,
    "logoURI": "https://coin-images.coingecko.com/coins/images/5111/large/Beldex.png?1696505631",
    "coingeckoId": "beldex"
  },
  {
    "chainId": 8453,
    "address": "0x6bb7a212910682dcfdbd5bcbb3e28fb4e8da10ee",
    "symbol": "GHO",
    "name": "GHO",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/30663/large/gho-token-logo.png?1720517092",
    "coingeckoId": "gho"
  },
  {
    "chainId": 8453,
    "address": "0x758a3e0b1f842c9306b783f8a4078c6c8c03a270",
    "symbol": "USD0",
    "name": "Usual USD",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/38272/large/USD0LOGO.png?1716962811",
    "coingeckoId": "usual-usd"
  },
  {
    "chainId": 8453,
    "address": "0xd879846cbe20751bde8a9342a3cca00a3e56ca47",
    "symbol": "EURSAFO",
    "name": "Spiko Amundi Overnight Swap Fund (EUR)",
    "decimals": 5,
    "logoURI": "https://coin-images.coingecko.com/coins/images/102172591/large/Fund_eurSAF0.png?1774104814",
    "coingeckoId": "spiko-amundi-overnight-swap-fund-eur"
  },
  {
    "chainId": 8453,
    "address": "0x3055913c90fcc1a6ce9a358911721eeb942013a1",
    "symbol": "CAKE",
    "name": "PancakeSwap",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/12632/large/pancakeswap-cake-logo_%281%29.png?1696512440",
    "coingeckoId": "pancakeswap-token"
  },
  {
    "chainId": 8453,
    "address": "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
    "symbol": "AERO",
    "name": "Aerodrome Finance",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/31745/large/token.png?1696530564",
    "coingeckoId": "aerodrome-finance"
  },
  {
    "chainId": 8453,
    "address": "0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42",
    "symbol": "EURC",
    "name": "EURC",
    "decimals": 6,
    "logoURI": "https://coin-images.coingecko.com/coins/images/26045/large/EURC.png?1769615705",
    "coingeckoId": "euro-coin"
  },
  {
    "chainId": 8453,
    "address": "0x50da645f148798f68ef2d7db7c1cb22a6819bb2c",
    "symbol": "SPX",
    "name": "SPX6900",
    "decimals": 8,
    "logoURI": "https://coin-images.coingecko.com/coins/images/31401/large/centeredcoin_%281%29.png?1737048493",
    "coingeckoId": "spx6900"
  },
  {
    "chainId": 8453,
    "address": "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b",
    "symbol": "VIRTUAL",
    "name": "Virtuals Protocol",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/34057/large/LOGOMARK.png?1708356054",
    "coingeckoId": "virtual-protocol"
  },
  {
    "chainId": 8453,
    "address": "0xd993935e13851dd7517af10687ec7e5022127228",
    "symbol": "APXUSD",
    "name": "apxUSD",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/102172243/large/apxUSD.png?1772448502",
    "coingeckoId": "apxusd"
  },
  {
    "chainId": 8453,
    "address": "0x8ee73c484a26e0a5df2ee2a4960b789967dd0415",
    "symbol": "CRV",
    "name": "Curve DAO",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/12124/large/Curve.png?1696511967",
    "coingeckoId": "curve-dao-token"
  },
  {
    "chainId": 8453,
    "address": "0x6c240dda6b5c336df09a4d011139beaaa1ea2aa2",
    "symbol": "ETHFI",
    "name": "Ether.fi",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/35958/large/etherfi.jpeg?1710254562",
    "coingeckoId": "ether-fi"
  },
  {
    "chainId": 8453,
    "address": "0x6985884c4392d348587b19cb9eaaf157f13271cd",
    "symbol": "ZRO",
    "name": "LayerZero",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/28206/large/ftxG9_TJ_400x400.jpeg?1696527208",
    "coingeckoId": "layerzero"
  },
  {
    "chainId": 8453,
    "address": "0x70c8392de9b39a1e48d12a70af6ff4be25d6d0a2",
    "symbol": "CHZ",
    "name": "Chiliz",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/8834/large/CHZ_Token_updated.png?1696508986",
    "coingeckoId": "chiliz"
  },
  {
    "chainId": 8453,
    "address": "0xa99f6e6785da0f5d6fb42495fe424bce029eeb3e",
    "symbol": "PENDLE",
    "name": "Pendle",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/15069/large/Pendle_Logo_Normal-03.png?1696514728",
    "coingeckoId": "pendle"
  },
  {
    "chainId": 8453,
    "address": "0x09be1692ca16e06f536f0038ff11d1da8524adb1",
    "symbol": "TEL",
    "name": "Telcoin",
    "decimals": 2,
    "logoURI": "https://coin-images.coingecko.com/coins/images/1899/large/tel.png?1696502892",
    "coingeckoId": "telcoin"
  },
  {
    "chainId": 8453,
    "address": "0x060cb087a9730e13aa191f31a6d86bff8dfcdcc0",
    "symbol": "OHM",
    "name": "Olympus",
    "decimals": 9,
    "logoURI": "https://coin-images.coingecko.com/coins/images/14483/large/token_OHM_%281%29.png?1696514169",
    "coingeckoId": "olympus"
  },
  {
    "chainId": 8453,
    "address": "0x417ac0e078398c154edfadd9ef675d30be60af93",
    "symbol": "CRVUSD",
    "name": "crvUSD",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/30118/large/crvusd.jpg?1746670973",
    "coingeckoId": "crvusd"
  },
  {
    "chainId": 8453,
    "address": "0x0a1a1a107e45b7ced86833863f482bc5f4ed82ef",
    "symbol": "USDAI",
    "name": "USDai",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/55857/large/USDai_Token_Full_Glyph.png?1755229050",
    "coingeckoId": "usdai"
  },
  {
    "chainId": 8453,
    "address": "0x2c271ddf484ac0386d216eb7eb9ff02d4dc0f6aa",
    "symbol": "APYUSD",
    "name": "apyUSD",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/102172527/large/apyUSD.png?1773763322",
    "coingeckoId": "apyusd"
  },
  {
    "chainId": 8453,
    "address": "0x9e1028f5f1d5ede59748ffcee5532509976840e0",
    "symbol": "COMP",
    "name": "Compound",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/10775/large/COMP.png?1696510737",
    "coingeckoId": "compound-governance-token"
  },
  {
    "chainId": 8453,
    "address": "0x688aee022aa544f150678b8e5720b6b96a9e9a2f",
    "symbol": "SYRUP",
    "name": "Maple Finance",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/51232/large/_syrup_token_logo.png?1747292046",
    "coingeckoId": "syrup"
  },
  {
    "chainId": 8453,
    "address": "0x7d214438d0f27afccc23b3d1e1a53906ace5cfea",
    "symbol": "REUSD",
    "name": "Re Protocol reUSD",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/66291/large/Points_Program_Group_91.png?1749676055",
    "coingeckoId": "re-protocol-reusd"
  },
  {
    "chainId": 8453,
    "address": "0xbf927b841994731c573bdf09ceb0c6b0aa887cdd",
    "symbol": "VELVET",
    "name": "Velvet",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/67194/large/velvet.jpg?1752054592",
    "coingeckoId": "velvet"
  },
  {
    "chainId": 8453,
    "address": "0xe4880249745eac5f1ed9d8f7df844792d560e750",
    "symbol": "USTBL",
    "name": "Spiko US T-Bills Money Market Fund",
    "decimals": 5,
    "logoURI": "https://coin-images.coingecko.com/coins/images/39666/large/USTB.png?1723541269",
    "coingeckoId": "spiko-us-t-bills-money-market-fund"
  },
  {
    "chainId": 8453,
    "address": "0x9c632e6aaa3ea73f91554f8a3cb2ed2f29605e0c",
    "symbol": "XCN",
    "name": "Onyxcoin",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/24210/large/onyxlogo.jpg?1696523397",
    "coingeckoId": "chain-2"
  },
  {
    "chainId": 8453,
    "address": "0xa81a52b4dda010896cdd386c7fbdc5cdc835ba23",
    "symbol": "TRAC",
    "name": "OriginTrail",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/1877/large/TRAC.jpg?1696502873",
    "coingeckoId": "origintrail"
  },
  {
    "chainId": 8453,
    "address": "0x70654aad8b7734dc319d0c3608ec7b32e03fa162",
    "symbol": "SATUSD",
    "name": "Satoshi Stablecoin",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/37760/large/Instagram_post_-_25.png?1715475306",
    "coingeckoId": "satoshi-stablecoin"
  },
  {
    "chainId": 8453,
    "address": "0x2081ab0d9ec9e4303234ab26d86b20b3367946ee",
    "symbol": "EIGEN",
    "name": "EigenCloud (prev. EigenLayer)",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/37441/large/eigencloud.jpg?1751003565",
    "coingeckoId": "eigenlayer"
  },
  {
    "chainId": 8453,
    "address": "0xac531eb26ca1d21b85126de8fb87e80e09002dcf",
    "symbol": "SAND",
    "name": "The Sandbox",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/12129/large/sandbox_logo.jpg?1696511971",
    "coingeckoId": "the-sandbox"
  },
  {
    "chainId": 8453,
    "address": "0x0bb754d8940e283d9ff6855ab5dafbc14165c059",
    "symbol": "SAFO",
    "name": "Spiko Amundi Overnight Swap Fund",
    "decimals": 5,
    "logoURI": "https://coin-images.coingecko.com/coins/images/102172590/large/Fund_usdSAFO.png?1774104804",
    "coingeckoId": "safo"
  },
  {
    "chainId": 8453,
    "address": "0x00000000efe302beaa2b3e6e1b18d08d69a9012a",
    "symbol": "AUSD",
    "name": "AUSD",
    "decimals": 6,
    "logoURI": "https://coin-images.coingecko.com/coins/images/39284/large/AUSD_1024px.png?1764684132",
    "coingeckoId": "agora-dollar"
  },
  {
    "chainId": 8453,
    "address": "0xa4a2e2ca3fbfe21aed83471d28b6f65a233c6e00",
    "symbol": "TIBBIR",
    "name": "Ribbita by Virtuals",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/54970/large/Untitled_design.png?1742941268",
    "coingeckoId": "ribbita-by-virtuals"
  },
  {
    "chainId": 8453,
    "address": "0x5dd1a7a369e8273371d2dbf9d83356057088082c",
    "symbol": "FT",
    "name": "Flying Tulip",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/68285/large/FlyingTulip_FT_200px.png?1759802398",
    "coingeckoId": "flying-tulip"
  },
  {
    "chainId": 8453,
    "address": "0xfdd22ce6d1f66bc0ec89b20bf16ccb6670f55a5a",
    "symbol": "THBILL",
    "name": "Theo Short Duration US Treasury Fund",
    "decimals": 6,
    "logoURI": "https://coin-images.coingecko.com/coins/images/67650/large/thBILL.png?1753401034",
    "coingeckoId": "theo-short-duration-us-treasury-fund"
  },
  {
    "chainId": 8453,
    "address": "0xe5020a6d073a794b6e7f05678707de47986fb0b6",
    "symbol": "FRXUSD",
    "name": "Frax USD",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/53963/large/frxUSD.png?1737792154",
    "coingeckoId": "frax-usd"
  },
  {
    "chainId": 8453,
    "address": "0x98d0baa52b2d063e780de12f615f963fe8537553",
    "symbol": "KAITO",
    "name": "KAITO",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/54411/large/Qm4DW488_400x400.jpg?1739552780",
    "coingeckoId": "kaito"
  },
  {
    "chainId": 8453,
    "address": "0x1b4617734c43f6159f3a70b7e06d883647512778",
    "symbol": "AWE",
    "name": "AWE Network",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/8713/large/awe-network.jpg?1747816016",
    "coingeckoId": "stp-network"
  },
  {
    "chainId": 8453,
    "address": "0xc5fecc3a29fb57b5024eec8a2239d4621e111cbe",
    "symbol": "1INCH",
    "name": "1INCH",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/13469/large/1inch-logo.jpeg?1759404663",
    "coingeckoId": "1inch"
  },
  {
    "chainId": 8453,
    "address": "0x4bfaa776991e85e5f8b1255461cbbd216cfc714f",
    "symbol": "HOME",
    "name": "HOME",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/54873/large/defi-app.png?1742235743",
    "coingeckoId": "home"
  },
  {
    "chainId": 8453,
    "address": "0x0dc28efba8c6e0c14fa7391636b8bec86c4c83d6",
    "symbol": "BSB",
    "name": "Block Street",
    "decimals": 17,
    "logoURI": "https://coin-images.coingecko.com/coins/images/102172257/large/bsb_400x400.jpg?1772553610",
    "coingeckoId": "block-street"
  },
  {
    "chainId": 8453,
    "address": "0x9d0e8f5b25384c7310cb8c6ae32c8fbeb645d083",
    "symbol": "DRV",
    "name": "Derive",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/52889/large/Token_Logo.png?1734601695",
    "coingeckoId": "derive"
  },
  {
    "chainId": 8453,
    "address": "0x624e2e7fdc8903165f64891672267ab0fcb98831",
    "symbol": "SOSO",
    "name": "SoSoValue",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/53919/large/soso.jpg?1737717378",
    "coingeckoId": "sosovalue"
  },
  {
    "chainId": 8453,
    "address": "0xda7ad9dea9397cffddae2f8a052b82f1484252b3",
    "symbol": "RIVER",
    "name": "River",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/69318/large/river-token.png?1758523089",
    "coingeckoId": "river"
  },
  {
    "chainId": 8453,
    "address": "0xc694a91e6b071bf030a18bd3053a7fe09b6dae69",
    "symbol": "COW",
    "name": "CoW Protocol",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/24384/large/CoW-token_logo.png?1719524382",
    "coingeckoId": "cow-protocol"
  },
  {
    "chainId": 8453,
    "address": "0xe5e851b01dd3eda24fde709a407db44555b6d1e0",
    "symbol": "RIF",
    "name": "Rootstock Infrastructure Framework",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/7460/large/8befc44a46c247e8a3f7fc8abba586b1_%283%29.png?1705501867",
    "coingeckoId": "rif-token"
  },
  {
    "chainId": 8453,
    "address": "0x61e030a56d33e8260fdd81f03b162a79fe3449cd",
    "symbol": "FLUID",
    "name": "Fluid",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/14688/large/Logo_1_%28brighter%29.png?1734430693",
    "coingeckoId": "instadapp"
  },
  {
    "chainId": 8453,
    "address": "0xab36452dbac151be02b16ca17d8919826072f64a",
    "symbol": "RSR",
    "name": "Reserve Rights",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/8365/large/RSR_Blue_Circle_1000.png?1721777856",
    "coingeckoId": "reserve-rights-token"
  },
  {
    "chainId": 8453,
    "address": "0xc0634090f2fe6c6d75e61be2b949464abb498973",
    "symbol": "KTA",
    "name": "Keeta",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/54723/large/2025-03-05_22.53.06.jpg?1741234207",
    "coingeckoId": "keeta"
  },
  {
    "chainId": 8453,
    "address": "0x22e6966b799c4d5b13be962e1d117b56327fda66",
    "symbol": "SNX",
    "name": "Synthetix",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/3406/large/SNX.png?1696504103",
    "coingeckoId": "havven"
  },
  {
    "chainId": 8453,
    "address": "0xf43eb8de897fbc7f2502483b2bef7bb9ea179229",
    "symbol": "ZEN",
    "name": "Horizen",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/691/large/Horizen2.0-logo_icon-on-yellow_%281%29.png?1751696763",
    "coingeckoId": "zencash"
  },
  {
    "chainId": 8453,
    "address": "0x032d86656db142138ac97d2c5c4e3766e8c0482d",
    "symbol": "ALLO",
    "name": "Allora",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/70609/large/allo-token.png?1763451165",
    "coingeckoId": "allora"
  },
  {
    "chainId": 8453,
    "address": "0x9b5e262cf9bb04869ab40b19af91d2dc85761722",
    "symbol": "NOCK",
    "name": "Nockchain",
    "decimals": 16,
    "logoURI": "https://coin-images.coingecko.com/coins/images/68474/large/GrCcG9N9_400x400.jpg?1755845184",
    "coingeckoId": "nockchain"
  },
  {
    "chainId": 8453,
    "address": "0x2a66d51407b84b82b5aff3dec4d49f72cbcd322a",
    "symbol": "BEAM",
    "name": "Beam",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/32417/large/cgicon.png?1747892021",
    "coingeckoId": "beam-2"
  },
  {
    "chainId": 8453,
    "address": "0xdcf5130274753c8050ab061b1a1dcbf583f5bfd0",
    "symbol": "VCNT",
    "name": "ViciCoin",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/31305/large/ViciCoin_-_small.png?1696530124",
    "coingeckoId": "vicicoin"
  },
  {
    "chainId": 8453,
    "address": "0xca72827a3d211cfd8f6b00ac98824872b72cab49",
    "symbol": "CGUSD",
    "name": "Cygnus Finance Global USD",
    "decimals": 6,
    "logoURI": "https://coin-images.coingecko.com/coins/images/35628/large/cgUSD.png?1709291316",
    "coingeckoId": "cygnus-finance-global-usd"
  },
  {
    "chainId": 8453,
    "address": "0x1aa8fd5bcce2231c6100d55bf8b377cff33acfc3",
    "symbol": "RAVE",
    "name": "RaveDAO",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/70544/large/coin.jpeg?1762452940",
    "coingeckoId": "ravedao"
  },
  {
    "chainId": 8453,
    "address": "0x9e6a46f294bb67c20f1d1e7afb0bbef614403b55",
    "symbol": "MAG7.SSI",
    "name": "MAG7.ssi",
    "decimals": 8,
    "logoURI": "https://coin-images.coingecko.com/coins/images/52962/large/mag7.png?1734863745",
    "coingeckoId": "mag7-ssi"
  },
  {
    "chainId": 8453,
    "address": "0x19e8d59ff3d7a31289e0dc04db48d43b02c7ffa6",
    "symbol": "CYS",
    "name": "Cysic",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/71025/large/cysic.png?1765330348",
    "coingeckoId": "cysic"
  },
  {
    "chainId": 8453,
    "address": "0xd2047ebdb205ee6862b69ae9fb3501652cc97d36",
    "symbol": "BRLV",
    "name": "Crown BRLV",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/102172108/large/BRLV.png?1775604601",
    "coingeckoId": "crown-brlv"
  },
  {
    "chainId": 8453,
    "address": "0x0c1c1c109fe34733fca54b82d7b46b75cfb71f6e",
    "symbol": "CHIP",
    "name": "USD.AI",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/102171777/large/CHIP_Token_Logo_Large.png?1776777444",
    "coingeckoId": "chip-2"
  },
  {
    "chainId": 8453,
    "address": "0x9eaf8c1e34f05a589eda6bafdf391cf6ad3cb239",
    "symbol": "YFI",
    "name": "yearn.finance",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/11849/large/yearn.jpg?1696511720",
    "coingeckoId": "yearn-finance"
  },
  {
    "chainId": 8453,
    "address": "0x226a2fa2556c48245e57cd1cba4c6c9e67077dd2",
    "symbol": "BIO",
    "name": "Bio Protocol",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/53022/large/bio.jpg?1735011002",
    "coingeckoId": "bio-protocol"
  },
  {
    "chainId": 8453,
    "address": "0x532f27101965dd16442e59d40670faf5ebb142e4",
    "symbol": "BRETT",
    "name": "Brett",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/35529/large/1000050750.png?1709031995",
    "coingeckoId": "based-brett"
  },
  {
    "chainId": 8453,
    "address": "0x391359ab0ccef572dcac78f74e47d7c06db0b982",
    "symbol": "SUPER",
    "name": "SuperVerse",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/14040/large/SV-Logo-200x200.png?1706880312",
    "coingeckoId": "superfarm"
  },
  {
    "chainId": 8453,
    "address": "0x3792dbdd07e87413247df995e692806aa13d3299",
    "symbol": "OMI",
    "name": "ECOMI",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/4428/large/ECOMI.png?1696505023",
    "coingeckoId": "ecomi"
  },
  {
    "chainId": 8453,
    "address": "0xb0ffa8000886e57f86dd5264b9582b2ad87b2b91",
    "symbol": "W",
    "name": "Wormhole",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/35087/large/W_Token_%283%29.png?1758122686",
    "coingeckoId": "wormhole"
  },
  {
    "chainId": 8453,
    "address": "0xb9e1fd5a02d3a33b25a14d661414e6ed6954a721",
    "symbol": "SOON",
    "name": "SOON",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/55124/large/red_2.PNG?1743843131",
    "coingeckoId": "soon-2"
  },
  {
    "chainId": 8453,
    "address": "0xf4d97f2da56e8c3098f3a8d538db630a2606a024",
    "symbol": "DIEM",
    "name": "Diem",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/68436/large/DIEM_SeaMid_-_200px.png?1755734213",
    "coingeckoId": "diem"
  },
  {
    "chainId": 8453,
    "address": "0x84a9183c9d11146d8e6a820dfc675a61b11eadeb",
    "symbol": "BASEDHYPE",
    "name": "BasedHype",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/68733/large/BasedHype_Logo.png?1756408633",
    "coingeckoId": "basedhype"
  },
  {
    "chainId": 8453,
    "address": "0x4ed4e862860bed51a9570b96d89af5e1b0efefed",
    "symbol": "DEGEN",
    "name": "Degen",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/34515/large/android-chrome-512x512.png?1706198225",
    "coingeckoId": "degen-base"
  },
  {
    "chainId": 8453,
    "address": "0xf3dd141109dfe8e4c006f88a2a8747a086e7c1f8",
    "symbol": "HOT",
    "name": "Holo",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/3348/large/hot-mark-med.png?1747766692",
    "coingeckoId": "holotoken"
  },
  {
    "chainId": 8453,
    "address": "0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4",
    "symbol": "TOSHI",
    "name": "Toshi",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/31126/large/Toshi_Logo_-_Circular.png?1721677476",
    "coingeckoId": "toshi"
  },
  {
    "chainId": 8453,
    "address": "0x23ee2343b892b1bb63503a4fabc840e0e2c6810f",
    "symbol": "AXL",
    "name": "Axelar",
    "decimals": 6,
    "logoURI": "https://coin-images.coingecko.com/coins/images/27277/large/V-65_xQ1_400x400.jpeg?1696526329",
    "coingeckoId": "axelar"
  },
  {
    "chainId": 8453,
    "address": "0x55380fe7a1910dff29a47b622057ab4139da42c5",
    "symbol": "FXUSD",
    "name": "f(x) Protocol fxUSD",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/36202/large/fxUSD.jpg?1710833113",
    "coingeckoId": "f-x-protocol-fxusd"
  },
  {
    "chainId": 8453,
    "address": "0xd4554bea546efa83c1e6b389ecac40ea999b3e78",
    "symbol": "SQD",
    "name": "SQD",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/37869/large/New_Logo_SQD_Icon.png?1720048443",
    "coingeckoId": "subsquid"
  },
  {
    "chainId": 8453,
    "address": "0x7d49a065d17d6d4a55dc13649901fdbb98b2afba",
    "symbol": "SUSHI",
    "name": "Sushi",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/12271/large/512x512_Logo_no_chop.png?1696512101",
    "coingeckoId": "sushi"
  },
  {
    "chainId": 8453,
    "address": "0xdd629e5241cbc5919847783e6c96b2de4754e438",
    "symbol": "MTBILL",
    "name": "Midas mTBILL",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/37839/large/mTBILL_token.png?1728417279",
    "coingeckoId": "midas-mtbill"
  },
  {
    "chainId": 8453,
    "address": "0x4621b7a9c75199271f773ebd9a499dbd165c3191",
    "symbol": "DOLA",
    "name": "DOLA",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/14287/large/dola.png?1696513984",
    "coingeckoId": "dola-usd"
  },
  {
    "chainId": 8453,
    "address": "0x3073f7aaa4db83f95e9fff17424f71d4751a3073",
    "symbol": "MOVE",
    "name": "Movement",
    "decimals": 8,
    "logoURI": "https://coin-images.coingecko.com/coins/images/39345/large/movement-testnet-token.png?1721878759",
    "coingeckoId": "movement"
  },
  {
    "chainId": 8453,
    "address": "0xe0cd4cacddcbf4f36e845407ce53e87717b6601d",
    "symbol": "ICNT",
    "name": "Impossible Cloud Network Token",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/55484/large/ICNT_token_%281%29_%281%29.png?1751614146",
    "coingeckoId": "impossible-cloud-network-token"
  },
  {
    "chainId": 8453,
    "address": "0x2da56acb9ea78330f947bd57c54119debda7af71",
    "symbol": "MOG",
    "name": "Mog Coin",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/31059/large/MOG_LOGO_200x200.png?1696529893",
    "coingeckoId": "mog-coin"
  },
  {
    "chainId": 8453,
    "address": "0x5576d6ed9181f2225aff5282ac0ed29f755437ea",
    "symbol": "SERV",
    "name": "OpenServ",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/51430/large/X_Logo_Blue_%282%29.png?1747853206",
    "coingeckoId": "openserv"
  },
  {
    "chainId": 8453,
    "address": "0x22af33fe49fd1fa80c7149773dde5890d3c76f3b",
    "symbol": "BNKR",
    "name": "BankrCoin",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/52626/large/bankr-static.png?1736405365",
    "coingeckoId": "bankercoin-2"
  },
  {
    "chainId": 8453,
    "address": "0xd6122ddada244913521f3d62006eaf756c157660",
    "symbol": "BR",
    "name": "Bedrock",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/54908/large/BR_200px.png?1742453499",
    "coingeckoId": "bedrock-token"
  },
  {
    "chainId": 8453,
    "address": "0x407a5fb66cb1b3d50004f7091c08a27b42ba6d6f",
    "symbol": "ROBO",
    "name": "Fabric Protocol",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/102172005/large/fab.png?1772080701",
    "coingeckoId": "robo-token-2"
  },
  {
    "chainId": 8453,
    "address": "0xebb7873213c8d1d9913d8ea39aa12d74cb107995",
    "symbol": "XVS",
    "name": "Venus",
    "decimals": 18,
    "logoURI": "https://coin-images.coingecko.com/coins/images/12677/large/XVS_Token.jpg?1727454303",
    "coingeckoId": "venus"
  }
];

export const curatedTokens = {
  ethereum: ethereumTokens,
  arbitrum: arbitrumTokens,
  base: baseTokens,
} as const;
