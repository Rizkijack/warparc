// WarpArc â€” USDC bridges via Circle CCTP V2 (burn-and-mint, the only canonical
// route to/from Arc per https://docs.arc.io/integrate/infrastructure/bridges).
// Manual flow: approve â†’ depositForBurn â†’ poll Iris attestation â†’ receiveMessage.
// Forwarding Service: approve â†’ depositForBurnWithHook("cctp-forward") â†’ Circle
// submits the destination mint (no destination gas needed). See the official
// quickstart: developers.circle.com/cctp/quickstarts/transfer-usdc-ethereum-to-arc
// The ABT token keeps the DEPRECATED legacy LayerZero OFT path (ABT demo only).
"use strict";

// --- i18n (internationalization) -----------------------------------------------
const LANG_KEY = "warparc:lang";

const TRANSLATIONS = {
	en: {
		mainnet: "Mainnet", testnet: "Testnet", notConnected: "Not Connected",
		connectWallet: "Connect Wallet", crossChainBridge: "Cross-Chain Bridge",
		amount: "Amount", balance: "Balance", estGasFee: "Estimated Gas Fee (source)",
		cctpFee: "CCTP Fast-Transfer Fee (USDC)",
		forwardingService: "Forwarding Service â€” Circle submits the mint for you (extra fee, no destination gas needed)",
		unfinishedBridge: "Unfinished bridge detected", resumeMint: "Resume mint",
		dismiss: "Dismiss", burn: "Burn", attestation: "Attestation", mint: "Mint",
		enterAmount: "Enter amount", cctpContracts: "CCTP V2 Contracts",
		txHistory: "Transaction History", noTxs: "No transactions yet",
		footerText: "WarpArc Bridge Â· USDC via Circle CCTP V2",
		systemStatus: "System Status", faucet: "Faucet",
		sameChain: "Same chain selected", notDeployed: "not deployed",
		approving: "Approving USDC...", burning: "Burning", waitingAttest: "Waiting for attestation...",
		minting: "Minting on", waitingForward: "Waiting for Circle forward...",
		bridgeComplete: "Bridge complete!", bridgeFailed: "Bridge failed: ",
		resumeFailed: "Resume failed: ", connectFirst: "Connect your wallet first",
		enterValidAmount: "Enter a valid amount", invalidAmount: "Invalid amount format",
		amountMustExceed0: "Amount must be greater than 0", amountExceeds: "Amount exceeds your",
		cctpUnavailable: "CCTP not available on this route",
		networkMismatch: "Source and destination must be on the same network (testnet/mainnet)",
		forwardUnavailable: "Forwarding fee quote unavailable â€” turn off Forwarding Service or retry",
		amountMustExceedFee: "Amount must exceed the CCTP fee",
		switchingTo: "Switching wallet to", alreadyRelayed: "Mint was already submitted by a relayer â€” funds are on",
		forwarderStalled: "Forwarder hasn't completed â€” proceeding with manual mintâ€¦",
		resumeConfirm: "This burn was created for recipient",
		notOnChain: "Wallet is not on", abortMint: " â€” mint aborted before send",
		walletChanged: "Wallet account or chain changed mid-flow â€” aborting before send (no transaction was submitted)",
		noWallet: "No wallet detected. Install MetaMask.", connectionRejected: "Connection rejected: ",
		anotherBridge: "Another bridge flow is in progress",
		forwardCompleted: "Forward completed â€” funds are on",
		attestationTimeout: "Attestation timeout â€” the burn succeeded; mint can be retried with the burn tx hash",
		forwardTimeout: "Forward completion timeout â€” attestation signed, manual mint possible",
		forwardTimeoutNoAtt: "Forward completion timeout â€” attestation not signed yet; Circle may still forward it, or resume later from this page",
		usdcBridgingUnavailable: "USDC bridging unavailable on",
		bridgeNotDeployed: "Bridge not deployed on",
		bridgeToken: "Bridge", to: "to",
		ethNotAvailable: "ETH not available on",
		ethOnlyEvm: "ETH bridging only available on EVM chains (not Arc)",
		estFee: "Estimated Fee",
		estOutput: "Estimated Output",
		estTime: "Estimated Time",
		relayDesc: "Relay Description",
		route: "Route",
		selectProtocol: "Select Protocol",
	},
	zh: {
		mainnet: "ä¸»ç½‘", testnet: "æµ‹è¯•ç½‘", notConnected: "æœªè¿žæŽ¥",
		connectWallet: "è¿žæŽ¥é’±åŒ…", crossChainBridge: "è·¨é“¾æ¡¥",
		amount: "é‡‘é¢", balance: "ä½™é¢", estGasFee: "é¢„ä¼°Gasè´¹ï¼ˆæºé“¾ï¼‰",
		cctpFee: "CCTPå¿«é€Ÿè½¬è´¦è´¹ï¼ˆUSDCï¼‰",
		forwardingService: "è½¬å‘æœåŠ¡ â€” Circleä¸ºæ‚¨æäº¤é“¸é€ ï¼ˆé¢å¤–è´¹ç”¨ï¼Œæ— éœ€ç›®æ ‡é“¾Gasï¼‰",
		unfinishedBridge: "æ£€æµ‹åˆ°æœªå®Œæˆçš„æ¡¥æŽ¥", resumeMint: "æ¢å¤é“¸é€ ",
		dismiss: "å…³é—­", burn: "é”€æ¯", attestation: "è¯æ˜Ž", mint: "é“¸é€ ",
		enterAmount: "è¾“å…¥é‡‘é¢", cctpContracts: "CCTP V2 åˆçº¦",
		txHistory: "äº¤æ˜“åŽ†å²", noTxs: "æš‚æ— äº¤æ˜“",
		footerText: "WarpArcæ¡¥ Â· USDCé€šè¿‡Circle CCTP V2",
		systemStatus: "ç³»ç»ŸçŠ¶æ€", faucet: "æ°´é¾™å¤´",
		sameChain: "å·²é€‰æ‹©ç›¸åŒé“¾", notDeployed: "æœªéƒ¨ç½²",
		approving: "æŽˆæƒUSDCä¸­...", burning: "é”€æ¯ä¸­", waitingAttest: "ç­‰å¾…è¯æ˜Ž...",
		minting: "é“¸é€ ä¸­", waitingForward: "ç­‰å¾…Circleè½¬å‘...",
		bridgeComplete: "æ¡¥æŽ¥å®Œæˆï¼", bridgeFailed: "æ¡¥æŽ¥å¤±è´¥ï¼š",
		resumeFailed: "æ¢å¤å¤±è´¥ï¼š", connectFirst: "è¯·å…ˆè¿žæŽ¥é’±åŒ…",
		enterValidAmount: "è¯·è¾“å…¥æœ‰æ•ˆé‡‘é¢", invalidAmount: "é‡‘é¢æ ¼å¼æ— æ•ˆ",
		amountMustExceed0: "é‡‘é¢å¿…é¡»å¤§äºŽ0", amountExceeds: "é‡‘é¢è¶…è¿‡æ‚¨çš„",
		cctpUnavailable: "æ­¤è·¯çº¿ä¸å¯ç”¨CCTP",
		networkMismatch: "æºé“¾å’Œç›®æ ‡é“¾å¿…é¡»åœ¨åŒä¸€ç½‘ç»œï¼ˆæµ‹è¯•ç½‘/ä¸»ç½‘ï¼‰",
		forwardUnavailable: "è½¬å‘è´¹ç”¨æŠ¥ä»·ä¸å¯ç”¨ â€” å…³é—­è½¬å‘æœåŠ¡æˆ–é‡è¯•",
		amountMustExceedFee: "é‡‘é¢å¿…é¡»è¶…è¿‡CCTPè´¹ç”¨",
		switchingTo: "åˆ‡æ¢é’±åŒ…åˆ°", alreadyRelayed: "é“¸é€ å·²è¢«ä¸­ç»§å™¨æäº¤ â€” èµ„é‡‘å·²åœ¨",
		forwarderStalled: "è½¬å‘å™¨æœªå®Œæˆ â€” æ‰‹åŠ¨é“¸é€ ç»§ç»­â€¦",
		resumeConfirm: "æ­¤é”€æ¯ä¸ºæ”¶æ¬¾äººåˆ›å»º",
		notOnChain: "é’±åŒ…ä¸åœ¨", abortMint: " â€” é“¸é€ åœ¨å‘é€å‰ä¸­æ­¢",
		walletChanged: "é’±åŒ…è´¦æˆ·æˆ–é“¾åœ¨æµç¨‹ä¸­æ›´æ”¹ â€” åœ¨å‘é€å‰ä¸­æ­¢ï¼ˆæœªæäº¤äº¤æ˜“ï¼‰",
		noWallet: "æœªæ£€æµ‹åˆ°é’±åŒ…ã€‚è¯·å®‰è£…MetaMaskã€‚", connectionRejected: "è¿žæŽ¥è¢«æ‹’ç»ï¼š",
		anotherBridge: "å¦ä¸€ä¸ªæ¡¥æŽ¥æµç¨‹æ­£åœ¨è¿›è¡Œ",
		forwardCompleted: "è½¬å‘å®Œæˆ â€” èµ„é‡‘å·²åœ¨",
		attestationTimeout: "è¯æ˜Žè¶…æ—¶ â€” é”€æ¯å·²æˆåŠŸï¼›å¯ä½¿ç”¨é”€æ¯äº¤æ˜“å“ˆå¸Œé‡è¯•é“¸é€ ",
		forwardTimeout: "è½¬å‘å®Œæˆè¶…æ—¶ â€” è¯æ˜Žå·²ç­¾åï¼Œå¯æ‰‹åŠ¨é“¸é€ ",
		forwardTimeoutNoAtt: "è½¬å‘å®Œæˆè¶…æ—¶ â€” è¯æ˜Žå°šæœªç­¾åï¼›Circleå¯èƒ½ä»åœ¨è½¬å‘ï¼Œæˆ–ç¨åŽä»Žæ­¤é¡µé¢æ¢å¤",
		usdcBridgingUnavailable: "USDCæ¡¥æŽ¥ä¸å¯ç”¨äºŽ",
		bridgeNotDeployed: "æ¡¥æŽ¥æœªéƒ¨ç½²äºŽ",
		bridgeToken: "æ¡¥æŽ¥", to: "åˆ°",
		ethNotAvailable: "ETHä¸å¯ç”¨äºŽ",
		ethOnlyEvm: "ETHæ¡¥æŽ¥ä»…é€‚ç”¨äºŽEVMé“¾ï¼ˆä¸åŒ…æ‹¬Arcï¼‰",
		estFee: "预估费用",
		estOutput: "预估输出",
		estTime: "预计时间",
		relayDesc: "中继描述",
		route: "路由",
		selectProtocol: "选择协议",
	},
	hi: {
		mainnet: "à¤®à¥‡à¤¨à¤¨à¥‡à¤Ÿ", testnet: "à¤Ÿà¥‡à¤¸à¥à¤Ÿà¤¨à¥‡à¤Ÿ", notConnected: "à¤•à¤¨à¥‡à¤•à¥à¤Ÿ à¤¨à¤¹à¥€à¤‚",
		connectWallet: "à¤µà¥‰à¤²à¥‡à¤Ÿ à¤•à¤¨à¥‡à¤•à¥à¤Ÿ à¤•à¤°à¥‡à¤‚", crossChainBridge: "à¤•à¥à¤°à¥‰à¤¸-à¤šà¥‡à¤¨ à¤¬à¥à¤°à¤¿à¤œ",
		amount: "à¤°à¤¾à¤¶à¤¿", balance: "à¤¬à¥ˆà¤²à¥‡à¤‚à¤¸", estGasFee: "à¤…à¤¨à¥à¤®à¤¾à¤¨à¤¿à¤¤ à¤—à¥ˆà¤¸ à¤¶à¥à¤²à¥à¤• (à¤¸à¥à¤°à¥‹à¤¤)",
		cctpFee: "CCTP à¤«à¤¾à¤¸à¥à¤Ÿ-à¤Ÿà¥à¤°à¤¾à¤‚à¤¸à¤«à¤° à¤¶à¥à¤²à¥à¤• (USDC)",
		forwardingService: "à¤«à¥‰à¤°à¤µà¤°à¥à¤¡à¤¿à¤‚à¤— à¤¸à¤°à¥à¤µà¤¿à¤¸ â€” Circle à¤†à¤ªà¤•à¥‡ à¤²à¤¿à¤ à¤®à¤¿à¤‚à¤Ÿ à¤¸à¤¬à¤®à¤¿à¤Ÿ à¤•à¤°à¤¤à¤¾ à¤¹à¥ˆ (à¤…à¤¤à¤¿à¤°à¤¿à¤•à¥à¤¤ à¤¶à¥à¤²à¥à¤•, à¤—à¤‚à¤¤à¤µà¥à¤¯ à¤—à¥ˆà¤¸ à¤•à¥€ à¤†à¤µà¤¶à¥à¤¯à¤•à¤¤à¤¾ à¤¨à¤¹à¥€à¤‚)",
		unfinishedBridge: "à¤…à¤ªà¥‚à¤°à¥à¤£ à¤¬à¥à¤°à¤¿à¤œ à¤•à¤¾ à¤ªà¤¤à¤¾ à¤šà¤²à¤¾", resumeMint: "à¤®à¤¿à¤‚à¤Ÿ à¤«à¤¿à¤° à¤¸à¥‡ à¤¶à¥à¤°à¥‚ à¤•à¤°à¥‡à¤‚",
		dismiss: "à¤–à¤¾à¤°à¤¿à¤œ à¤•à¤°à¥‡à¤‚", burn: "à¤¬à¤°à¥à¤¨", attestation: "à¤…à¤Ÿà¥‡à¤¸à¥à¤Ÿà¥‡à¤¶à¤¨", mint: "à¤®à¤¿à¤‚à¤Ÿ",
		enterAmount: "à¤°à¤¾à¤¶à¤¿ à¤¦à¤°à¥à¤œ à¤•à¤°à¥‡à¤‚", cctpContracts: "CCTP V2 à¤•à¥‰à¤¨à¥à¤Ÿà¥à¤°à¥ˆà¤•à¥à¤Ÿà¥à¤¸",
		txHistory: "à¤²à¥‡à¤¨à¤¦à¥‡à¤¨ à¤‡à¤¤à¤¿à¤¹à¤¾à¤¸", noTxs: "à¤…à¤­à¥€ à¤¤à¤• à¤•à¥‹à¤ˆ à¤²à¥‡à¤¨à¤¦à¥‡à¤¨ à¤¨à¤¹à¥€à¤‚",
		footerText: "WarpArc à¤¬à¥à¤°à¤¿à¤œ Â· USDC Circle CCTP V2 à¤•à¥‡ à¤®à¤¾à¤§à¥à¤¯à¤® à¤¸à¥‡",
		systemStatus: "à¤¸à¤¿à¤¸à¥à¤Ÿà¤® à¤¸à¥à¤¥à¤¿à¤¤à¤¿", faucet: "à¤«à¥‰à¤¸à¥‡à¤Ÿ",
		sameChain: "à¤¸à¤®à¤¾à¤¨ à¤šà¥‡à¤¨ à¤šà¤¯à¤¨à¤¿à¤¤", notDeployed: "à¤¤à¥ˆà¤¨à¤¾à¤¤ à¤¨à¤¹à¥€à¤‚",
		approving: "USDC à¤¸à¥à¤µà¥€à¤•à¥ƒà¤¤ à¤¹à¥‹ à¤°à¤¹à¤¾ à¤¹à¥ˆ...", burning: "à¤¬à¤°à¥à¤¨ à¤¹à¥‹ à¤°à¤¹à¤¾ à¤¹à¥ˆ", waitingAttest: "à¤…à¤Ÿà¥‡à¤¸à¥à¤Ÿà¥‡à¤¶à¤¨ à¤•à¥€ à¤ªà¥à¤°à¤¤à¥€à¤•à¥à¤·à¤¾...",
		minting: "à¤®à¤¿à¤‚à¤Ÿ à¤¹à¥‹ à¤°à¤¹à¤¾ à¤¹à¥ˆ", waitingForward: "Circle à¤«à¥‰à¤°à¤µà¤°à¥à¤¡ à¤•à¥€ à¤ªà¥à¤°à¤¤à¥€à¤•à¥à¤·à¤¾...",
		bridgeComplete: "à¤¬à¥à¤°à¤¿à¤œ à¤ªà¥‚à¤°à¥à¤£!", bridgeFailed: "à¤¬à¥à¤°à¤¿à¤œ à¤µà¤¿à¤«à¤²: ",
		resumeFailed: "à¤«à¤¿à¤° à¤¸à¥‡ à¤¶à¥à¤°à¥‚ à¤•à¤°à¤¨à¤¾ à¤µà¤¿à¤«à¤²: ", connectFirst: "à¤ªà¤¹à¤²à¥‡ à¤…à¤ªà¤¨à¤¾ à¤µà¥‰à¤²à¥‡à¤Ÿ à¤•à¤¨à¥‡à¤•à¥à¤Ÿ à¤•à¤°à¥‡à¤‚",
		enterValidAmount: "à¤®à¤¾à¤¨à¥à¤¯ à¤°à¤¾à¤¶à¤¿ à¤¦à¤°à¥à¤œ à¤•à¤°à¥‡à¤‚", invalidAmount: "à¤…à¤®à¤¾à¤¨à¥à¤¯ à¤°à¤¾à¤¶à¤¿ à¤ªà¥à¤°à¤¾à¤°à¥‚à¤ª",
		amountMustExceed0: "à¤°à¤¾à¤¶à¤¿ 0 à¤¸à¥‡ à¤…à¤§à¤¿à¤• à¤¹à¥‹à¤¨à¥€ à¤šà¤¾à¤¹à¤¿à¤", amountExceeds: "à¤°à¤¾à¤¶à¤¿ à¤†à¤ªà¤•à¥‡ à¤¸à¥‡ à¤…à¤§à¤¿à¤• à¤¹à¥ˆ",
		cctpUnavailable: "à¤‡à¤¸ à¤®à¤¾à¤°à¥à¤— à¤ªà¤° CCTP à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¨à¤¹à¥€à¤‚ à¤¹à¥ˆ",
		networkMismatch: "à¤¸à¥à¤°à¥‹à¤¤ à¤”à¤° à¤—à¤‚à¤¤à¤µà¥à¤¯ à¤¸à¤®à¤¾à¤¨ à¤¨à¥‡à¤Ÿà¤µà¤°à¥à¤• à¤ªà¤° à¤¹à¥‹à¤¨à¥‡ à¤šà¤¾à¤¹à¤¿à¤ (à¤Ÿà¥‡à¤¸à¥à¤Ÿà¤¨à¥‡à¤Ÿ/à¤®à¥‡à¤¨à¤¨à¥‡à¤Ÿ)",
		forwardUnavailable: "à¤«à¥‰à¤°à¤µà¤°à¥à¤¡à¤¿à¤‚à¤— à¤¶à¥à¤²à¥à¤• à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¨à¤¹à¥€à¤‚ â€” à¤«à¥‰à¤°à¤µà¤°à¥à¤¡à¤¿à¤‚à¤— à¤¸à¤°à¥à¤µà¤¿à¤¸ à¤¬à¤‚à¤¦ à¤•à¤°à¥‡à¤‚ à¤¯à¤¾ à¤ªà¥à¤¨à¤ƒ à¤ªà¥à¤°à¤¯à¤¾à¤¸ à¤•à¤°à¥‡à¤‚",
		amountMustExceedFee: "à¤°à¤¾à¤¶à¤¿ CCTP à¤¶à¥à¤²à¥à¤• à¤¸à¥‡ à¤…à¤§à¤¿à¤• à¤¹à¥‹à¤¨à¥€ à¤šà¤¾à¤¹à¤¿à¤",
		switchingTo: "à¤µà¥‰à¤²à¥‡à¤Ÿ à¤¸à¥à¤µà¤¿à¤š à¤¹à¥‹ à¤°à¤¹à¤¾ à¤¹à¥ˆ", alreadyRelayed: "à¤®à¤¿à¤‚à¤Ÿ à¤ªà¤¹à¤²à¥‡ à¤¹à¥€ à¤°à¤¿à¤²à¥‡à¤¯à¤° à¤¦à¥à¤µà¤¾à¤°à¤¾ à¤¸à¤¬à¤®à¤¿à¤Ÿ à¤•à¤¿à¤¯à¤¾ à¤œà¤¾ à¤šà¥à¤•à¤¾ à¤¹à¥ˆ â€” à¤«à¤‚à¤¡ à¤¹à¥ˆà¤‚",
		forwarderStalled: "à¤«à¥‰à¤°à¤µà¤°à¥à¤¡à¤° à¤ªà¥‚à¤°à¤¾ à¤¨à¤¹à¥€à¤‚ à¤¹à¥à¤† â€” à¤®à¥ˆà¤¨à¥à¤…à¤² à¤®à¤¿à¤‚à¤Ÿ à¤œà¤¾à¤°à¥€â€¦",
		resumeConfirm: "à¤¯à¤¹ à¤¬à¤°à¥à¤¨ à¤ªà¥à¤°à¤¾à¤ªà¥à¤¤à¤•à¤°à¥à¤¤à¤¾ à¤•à¥‡ à¤²à¤¿à¤ à¤¬à¤¨à¤¾à¤¯à¤¾ à¤—à¤¯à¤¾ à¤¥à¤¾",
		notOnChain: "à¤µà¥‰à¤²à¥‡à¤Ÿ à¤ªà¤° à¤¨à¤¹à¥€à¤‚ à¤¹à¥ˆ", abortMint: " â€” à¤­à¥‡à¤œà¤¨à¥‡ à¤¸à¥‡ à¤ªà¤¹à¤²à¥‡ à¤®à¤¿à¤‚à¤Ÿ à¤¨à¤¿à¤°à¤¸à¥à¤¤",
		walletChanged: "à¤µà¥‰à¤²à¥‡à¤Ÿ à¤–à¤¾à¤¤à¤¾ à¤¯à¤¾ à¤šà¥‡à¤¨ à¤¬à¤¦à¤² à¤—à¤¯à¤¾ â€” à¤­à¥‡à¤œà¤¨à¥‡ à¤¸à¥‡ à¤ªà¤¹à¤²à¥‡ à¤¨à¤¿à¤°à¤¸à¥à¤¤ (à¤•à¥‹à¤ˆ à¤²à¥‡à¤¨à¤¦à¥‡à¤¨ à¤¸à¤¬à¤®à¤¿à¤Ÿ à¤¨à¤¹à¥€à¤‚)",
		noWallet: "à¤•à¥‹à¤ˆ à¤µà¥‰à¤²à¥‡à¤Ÿ à¤¨à¤¹à¥€à¤‚ à¤®à¤¿à¤²à¤¾à¥¤ MetaMask à¤‡à¤‚à¤¸à¥à¤Ÿà¥‰à¤² à¤•à¤°à¥‡à¤‚à¥¤", connectionRejected: "à¤•à¤¨à¥‡à¤•à¥à¤¶à¤¨ à¤…à¤¸à¥à¤µà¥€à¤•à¥ƒà¤¤: ",
		anotherBridge: "à¤à¤• à¤”à¤° à¤¬à¥à¤°à¤¿à¤œ à¤ªà¥à¤°à¤•à¥à¤°à¤¿à¤¯à¤¾ à¤šà¤² à¤°à¤¹à¥€ à¤¹à¥ˆ",
		forwardCompleted: "à¤«à¥‰à¤°à¤µà¤°à¥à¤¡ à¤ªà¥‚à¤°à¥à¤£ â€” à¤«à¤‚à¤¡ à¤¹à¥ˆà¤‚",
		attestationTimeout: "à¤…à¤Ÿà¥‡à¤¸à¥à¤Ÿà¥‡à¤¶à¤¨ à¤Ÿà¤¾à¤‡à¤®à¤†à¤‰à¤Ÿ â€” à¤¬à¤°à¥à¤¨ à¤¸à¤«à¤²; à¤¬à¤°à¥à¤¨ tx à¤¹à¥ˆà¤¶ à¤¸à¥‡ à¤®à¤¿à¤‚à¤Ÿ à¤ªà¥à¤¨à¤ƒ à¤ªà¥à¤°à¤¯à¤¾à¤¸ à¤•à¤°à¥‡à¤‚",
		forwardTimeout: "à¤«à¥‰à¤°à¤µà¤°à¥à¤¡ à¤ªà¥‚à¤°à¥à¤£à¤¤à¤¾ à¤Ÿà¤¾à¤‡à¤®à¤†à¤‰à¤Ÿ â€” à¤…à¤Ÿà¥‡à¤¸à¥à¤Ÿà¥‡à¤¶à¤¨ à¤¹à¤¸à¥à¤¤à¤¾à¤•à¥à¤·à¤°à¤¿à¤¤, à¤®à¥ˆà¤¨à¥à¤…à¤² à¤®à¤¿à¤‚à¤Ÿ à¤¸à¤‚à¤­à¤µ",
		estFee: "अनुमानित शुल्क",
		estOutput: "अनुमानित आउटपुट",
		estTime: "अनुमानित समय",
		relayDesc: "रिले विवरण",
		route: "मार्ग",
		selectProtocol: "प्रोटोकॉल चुनें",
		forwardTimeoutNoAtt: "à¤«à¥‰à¤°à¤µà¤°à¥à¤¡ à¤ªà¥‚à¤°à¥à¤£à¤¤à¤¾ à¤Ÿà¤¾à¤‡à¤®à¤†à¤‰à¤Ÿ â€” à¤…à¤Ÿà¥‡à¤¸à¥à¤Ÿà¥‡à¤¶à¤¨ à¤…à¤­à¥€ à¤¤à¤• à¤¹à¤¸à¥à¤¤à¤¾à¤•à¥à¤·à¤°à¤¿à¤¤ à¤¨à¤¹à¥€à¤‚; Circle à¤…à¤­à¥€ à¤­à¥€ à¤«à¥‰à¤°à¤µà¤°à¥à¤¡ à¤•à¤° à¤¸à¤•à¤¤à¤¾ à¤¹à¥ˆ",
		usdcBridgingUnavailable: "USDC à¤¬à¥à¤°à¤¿à¤œà¤¿à¤‚à¤— à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¨à¤¹à¥€à¤‚ à¤¹à¥ˆ",
		bridgeNotDeployed: "à¤¬à¥à¤°à¤¿à¤œ à¤¤à¥ˆà¤¨à¤¾à¤¤ à¤¨à¤¹à¥€à¤‚ à¤¹à¥ˆ",
		bridgeToken: "à¤¬à¥à¤°à¤¿à¤œ", to: "à¤ªà¤°",
		ethNotAvailable: "ETH à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¨à¤¹à¥€à¤‚ à¤¹à¥ˆ",
		ethOnlyEvm: "ETH à¤¬à¥à¤°à¤¿à¤œà¤¿à¤‚à¤— à¤•à¥‡à¤µà¤² EVM à¤šà¥‡à¤¨ à¤ªà¤° à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¹à¥ˆ (Arc à¤¨à¤¹à¥€à¤‚)",
	},
	es: {
		mainnet: "Mainnet", testnet: "Testnet", notConnected: "No conectado",
		connectWallet: "Conectar billetera", crossChainBridge: "Puente cross-chain",
		amount: "Cantidad", balance: "Saldo", estGasFee: "Tarifa de gas estimada (origen)",
		cctpFee: "Tarifa CCTP Fast-Transfer (USDC)",
		forwardingService: "Servicio de reenvÃ­o â€” Circle envÃ­a el mint por ti (tarifa extra, sin gas de destino)",
		unfinishedBridge: "Puente incompleto detectado", resumeMint: "Reanudar mint",
		dismiss: "Descartar", burn: "Quema", attestation: "AttestaciÃ³n", mint: "Mint",
		enterAmount: "Ingresar cantidad", cctpContracts: "Contratos CCTP V2",
		txHistory: "Historial de transacciones", noTxs: "Sin transacciones aÃºn",
		footerText: "WarpArc Bridge Â· USDC vÃ­a Circle CCTP V2",
		systemStatus: "Estado del sistema", faucet: "Faucet",
		sameChain: "Misma cadena seleccionada", notDeployed: "no desplegado",
		approving: "Aprobando USDC...", burning: "Quemando", waitingAttest: "Esperando attestaciÃ³n...",
		minting: "AcuÃ±ando en", waitingForward: "Esperando reenvÃ­o de Circle...",
		bridgeComplete: "Â¡Puente completado!", bridgeFailed: "Puente fallido: ",
		resumeFailed: "ReanudaciÃ³n fallida: ", connectFirst: "Conecta tu billetera primero",
		enterValidAmount: "Ingresa una cantidad vÃ¡lida", invalidAmount: "Formato de cantidad invÃ¡lido",
		amountMustExceed0: "La cantidad debe ser mayor a 0", amountExceeds: "La cantidad excede tu",
		cctpUnavailable: "CCTP no disponible en esta ruta",
		networkMismatch: "Origen y destino deben estar en la misma red (testnet/mainnet)",
		forwardUnavailable: "CotizaciÃ³n de reenvÃ­o no disponible â€” desactiva el servicio o reintenta",
		amountMustExceedFee: "La cantidad debe exceder la tarifa CCTP",
		switchingTo: "Cambiando billetera a", alreadyRelayed: "El mint ya fue enviado por un relayer â€” fondos en",
		forwarderStalled: "Reenviador no completÃ³ â€” mint manual continuandoâ€¦",
		resumeConfirm: "Esta quema fue creada para el destinatario",
		notOnChain: "Billetera no estÃ¡ en", abortMint: " â€” mint abortado antes de enviar",
		estFee: "Tarifa estimada",
		estOutput: "Salida estimada",
		estTime: "Tiempo estimado",
		relayDesc: "Descripción del relé",
		route: "Ruta",
		selectProtocol: "Seleccionar protocolo",
		walletChanged: "Cuenta o cadena cambiÃ³ durante el flujo â€” abortando (sin transacciÃ³n enviada)",
		noWallet: "Sin billetera detectada. Instala MetaMask.", connectionRejected: "ConexiÃ³n rechazada: ",
		anotherBridge: "Otro flujo de puente en progreso",
		forwardCompleted: "ReenvÃ­o completado â€” fondos en",
		attestationTimeout: "Timeout de attestaciÃ³n â€” quema exitosa; reintenta mint con el hash",
		forwardTimeout: "Timeout de reenvÃ­o â€” attestaciÃ³n firmada, mint manual posible",
		forwardTimeoutNoAtt: "Timeout de reenvÃ­o â€” attestaciÃ³n no firmada aÃºn; Circle puede reenviar aÃºn",
		usdcBridgingUnavailable: "Puente USDC no disponible en",
		bridgeNotDeployed: "Puente no desplegado en",
		bridgeToken: "Puente", to: "a",
		ethNotAvailable: "ETH no disponible en",
		ethOnlyEvm: "Puente ETH solo disponible en cadenas EVM (no Arc)",
	},
	fr: {
		mainnet: "Mainnet", testnet: "Testnet", notConnected: "Non connectÃ©",
		connectWallet: "Connecter le portefeuille", crossChainBridge: "Pont cross-chain",
		amount: "Montant", balance: "Solde", estGasFee: "Frais de gas estimÃ©s (source)",
		cctpFee: "Frais CCTP Fast-Transfer (USDC)",
		forwardingService: "Service de transfert â€” Circle soumet le mint pour vous (frais supplÃ©mentaires, pas de gas de destination)",
		unfinishedBridge: "Pont inachevÃ© dÃ©tectÃ©", resumeMint: "Reprendre le mint",
		dismiss: "Ignorer", burn: "BrÃ»lage", attestation: "Attestation", mint: "Mint",
		enterAmount: "Entrer le montant", cctpContracts: "Contrats CCTP V2",
		txHistory: "Historique des transactions", noTxs: "Aucune transaction",
		footerText: "WarpArc Bridge Â· USDC via Circle CCTP V2",
		systemStatus: "Ã‰tat du systÃ¨me", faucet: "Faucet",
		sameChain: "MÃªme chaÃ®ne sÃ©lectionnÃ©e", notDeployed: "non dÃ©ployÃ©",
		approving: "Approbation USDC...", burning: "BrÃ»lage", waitingAttest: "En attente d'attestation...",
		minting: "Frappe sur", waitingForward: "En attente du transfert Circle...",
		bridgeComplete: "Pont terminÃ© !", bridgeFailed: "Pont Ã©chouÃ© : ",
		resumeFailed: "Reprise Ã©chouÃ©e : ", connectFirst: "Connectez d'abord votre portefeuille",
		enterValidAmount: "Entrez un montant valide", invalidAmount: "Format de montant invalide",
		amountMustExceed0: "Le montant doit Ãªtre supÃ©rieur Ã  0", amountExceeds: "Le montant dÃ©passe votre",
		cctpUnavailable: "CCTP non disponible sur cet itinÃ©raire",
		networkMismatch: "Source et destination doivent Ãªtre sur le mÃªme rÃ©seau (testnet/mainnet)",
		estFee: "Frais estimés",
		estOutput: "Sortie estimée",
		estTime: "Temps estimé",
		relayDesc: "Description du relais",
		route: "Route",
		selectProtocol: "Sélectionner le protocole",
		forwardUnavailable: "Cotisation de transfert indisponible â€” dÃ©sactivez le service ou rÃ©essayez",
		amountMustExceedFee: "Le montant doit dÃ©passer les frais CCTP",
		switchingTo: "Changement de portefeuille vers", alreadyRelayed: "Le mint a dÃ©jÃ  Ã©tÃ© soumis par un relayer â€” fonds sur",
		forwarderStalled: "Transfert non terminÃ© â€” mint manuel en coursâ€¦",
		resumeConfirm: "Ce brÃ»lage a Ã©tÃ© crÃ©Ã© pour le destinataire",
		notOnChain: "Portefeuille pas sur", abortMint: " â€” mint annulÃ© avant envoi",
		walletChanged: "Compte ou chaÃ®ne modifiÃ© pendant le flux â€” annulation (aucune transaction soumise)",
		noWallet: "Aucun portefeuille dÃ©tectÃ©. Installez MetaMask.", connectionRejected: "Connexion rejetÃ©e : ",
		anotherBridge: "Un autre flux de pont est en cours",
		forwardCompleted: "Transfert terminÃ© â€” fonds sur",
		attestationTimeout: "Timeout d'attestation â€” brÃ»lage rÃ©ussi ; rÃ©essayez le mint avec le hash",
		forwardTimeout: "Timeout de transfert â€” attestation signÃ©e, mint manuel possible",
		forwardTimeoutNoAtt: "Timeout de transfert â€” attestation pas encore signÃ©e ; Circle peut encore transfÃ©rer",
		usdcBridgingUnavailable: "Pont USDC non disponible sur",
		bridgeNotDeployed: "Pont non dÃ©ployÃ© sur",
		bridgeToken: "Pont", to: "vers",
		ethNotAvailable: "ETH non disponible sur",
		ethOnlyEvm: "Pont ETH disponible uniquement sur les chaÃ®nes EVM (pas Arc)",
	},
	ar: {
		mainnet: "Ø§Ù„Ø´Ø¨ÙƒØ© Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©", testnet: "Ø´Ø¨ÙƒØ© Ø§Ù„Ø§Ø®ØªØ¨Ø§Ø±", notConnected: "ØºÙŠØ± Ù…ØªØµÙ„",
		connectWallet: "Ø±Ø¨Ø· Ø§Ù„Ù…Ø­ÙØ¸Ø©", crossChainBridge: "Ø¬Ø³Ø± Ø¹Ø¨Ø± Ø§Ù„Ø³Ù„Ø§Ø³Ù„",
		amount: "Ø§Ù„Ù…Ø¨Ù„Øº", balance: "Ø§Ù„Ø±ØµÙŠØ¯", estGasFee: "Ø±Ø³ÙˆÙ… Ø§Ù„ØºØ§Ø² Ø§Ù„Ù…Ù‚Ø¯Ø±Ø© (Ø§Ù„Ù…ØµØ¯Ø±)",
		cctpFee: "Ø±Ø³ÙˆÙ… CCTP Ø§Ù„Ø³Ø±ÙŠØ¹Ø© (USDC)",
		forwardingService: "Ø®Ø¯Ù…Ø© Ø§Ù„ØªØ­ÙˆÙŠÙ„ â€” Circle ÙŠÙ‚Ø¯Ù… Ø§Ù„Ø³Ùƒ Ù„Ùƒ (Ø±Ø³ÙˆÙ… Ø¥Ø¶Ø§ÙÙŠØ©ØŒ Ù„Ø§ Ø­Ø§Ø¬Ø© Ù„ØºØ§Ø² Ø§Ù„ÙˆØ¬Ù‡Ø©)",
		unfinishedBridge: "ØªÙ… Ø§ÙƒØªØ´Ø§Ù Ø¬Ø³Ø± ØºÙŠØ± Ù…ÙƒØªÙ…Ù„", resumeMint: "Ø§Ø³ØªØ¦Ù†Ø§Ù Ø§Ù„Ø³Ùƒ",
		dismiss: "ØªØ¬Ø§Ù‡Ù„", burn: "Ø­Ø±Ù‚", attestation: "Ø´Ù‡Ø§Ø¯Ø©", mint: "Ø³Ùƒ",
		enterAmount: "Ø£Ø¯Ø®Ù„ Ø§Ù„Ù…Ø¨Ù„Øº", cctpContracts: "Ø¹Ù‚ÙˆØ¯ CCTP V2",
		txHistory: "Ø³Ø¬Ù„ Ø§Ù„Ù…Ø¹Ø§Ù…Ù„Ø§Øª", noTxs: "Ù„Ø§ Ù…Ø¹Ø§Ù…Ù„Ø§Øª Ø¨Ø¹Ø¯",
		footerText: "Ø¬Ø³Ø± WarpArc Â· USDC Ø¹Ø¨Ø± Circle CCTP V2",
		systemStatus: "Ø­Ø§Ù„Ø© Ø§Ù„Ù†Ø¸Ø§Ù…", faucet: "Ø§Ù„ØµÙ†Ø¨ÙˆØ±",
		sameChain: "Ù†ÙØ³ Ø§Ù„Ø³Ù„Ø³Ù„Ø© Ø§Ù„Ù…Ø­Ø¯Ø¯Ø©", notDeployed: "ØºÙŠØ± Ù…ÙÙ†Ø´Ø±",
		approving: "Ù…ÙˆØ§ÙÙ‚Ø© USDC...", burning: "Ø­Ø±Ù‚", waitingAttest: "Ø§Ù†ØªØ¸Ø§Ø± Ø§Ù„Ø´Ù‡Ø§Ø¯Ø©...",
		minting: "Ø³Ùƒ Ø¹Ù„Ù‰", waitingForward: "Ø§Ù†ØªØ¸Ø§Ø± ØªØ­ÙˆÙŠÙ„ Circle...",
		estFee: "الرسوم المقدرة",
		estOutput: "المخرجات المقدرة",
		estTime: "الوقت المقدر",
		relayDesc: "وصف المرحّل",
		route: "المسار",
		selectProtocol: "اختيار البروتوكول",
		bridgeComplete: "Ø§ÙƒØªÙ…Ù„ Ø§Ù„Ø¬Ø³Ø±!", bridgeFailed: "ÙØ´Ù„ Ø§Ù„Ø¬Ø³Ø±: ",
		resumeFailed: "ÙØ´Ù„ Ø§Ù„Ø§Ø³ØªØ¦Ù†Ø§Ù: ", connectFirst: "Ø§Ø±Ø¨Ø· Ù…Ø­ÙØ¸ØªÙƒ Ø£ÙˆÙ„Ø§Ù‹",
		enterValidAmount: "Ø£Ø¯Ø®Ù„ Ù…Ø¨Ù„ØºÙ‹Ø§ ØµØ§Ù„Ø­Ù‹Ø§", invalidAmount: "ØªÙ†Ø³ÙŠÙ‚ Ù…Ø¨Ù„Øº ØºÙŠØ± ØµØ§Ù„Ø­",
		amountMustExceed0: "ÙŠØ¬Ø¨ Ø£Ù† ÙŠÙƒÙˆÙ† Ø§Ù„Ù…Ø¨Ù„Øº Ø£ÙƒØ¨Ø± Ù…Ù† 0", amountExceeds: "Ø§Ù„Ù…Ø¨Ù„Øº ÙŠØªØ¬Ø§ÙˆØ²",
		cctpUnavailable: "CCTP ØºÙŠØ± Ù…ØªØ§Ø­ Ø¹Ù„Ù‰ Ù‡Ø°Ø§ Ø§Ù„Ù…Ø³Ø§Ø±",
		networkMismatch: "ÙŠØ¬Ø¨ Ø£Ù† ÙŠÙƒÙˆÙ† Ø§Ù„Ù…ØµØ¯Ø± ÙˆØ§Ù„ÙˆØ¬Ù‡Ø© Ø¹Ù„Ù‰ Ù†ÙØ³ Ø§Ù„Ø´Ø¨ÙƒØ© (Ø§Ø®ØªØ¨Ø§Ø±/Ø±Ø¦ÙŠØ³ÙŠØ©)",
		forwardUnavailable: "Ø¹Ø±Ø¶ Ø±Ø³ÙˆÙ… Ø§Ù„ØªØ­ÙˆÙŠÙ„ ØºÙŠØ± Ù…ØªØ§Ø­ â€” Ø£ÙˆÙ‚Ù Ø§Ù„Ø®Ø¯Ù…Ø© Ø£Ùˆ Ø£Ø¹Ø¯ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø©",
		amountMustExceedFee: "ÙŠØ¬Ø¨ Ø£Ù† ÙŠØªØ¬Ø§ÙˆØ² Ø§Ù„Ù…Ø¨Ù„Øº Ø±Ø³ÙˆÙ… CCTP",
		switchingTo: "ØªØ¨Ø¯ÙŠÙ„ Ø§Ù„Ù…Ø­ÙØ¸Ø© Ø¥Ù„Ù‰", alreadyRelayed: "ØªÙ… ØªÙ‚Ø¯ÙŠÙ… Ø§Ù„Ø³Ùƒ Ø¨Ø§Ù„ÙØ¹Ù„ Ø¨ÙˆØ§Ø³Ø·Ø© Ù…ÙØ±Ø­Ù‘Ù„ â€” Ø§Ù„Ø£Ù…ÙˆØ§Ù„ ÙÙŠ",
		forwarderStalled: "Ø§Ù„Ù…Ø­ÙˆÙ„ Ù„Ù… ÙŠÙƒØªÙ…Ù„ â€” Ø³Ùƒ ÙŠØ¯ÙˆÙŠ Ù…Ø³ØªÙ…Ø±â€¦",
		resumeConfirm: "ØªÙ… Ø¥Ù†Ø´Ø§Ø¡ Ù‡Ø°Ø§ Ø§Ù„Ø­Ø±Ù‚ Ù„Ù„Ù…Ø³ØªÙ„Ù…",
		notOnChain: "Ø§Ù„Ù…Ø­ÙØ¸Ø© Ù„ÙŠØ³Øª Ø¹Ù„Ù‰", abortMint: " â€” ØªÙ… Ø¥Ù„ØºØ§Ø¡ Ø§Ù„Ø³Ùƒ Ù‚Ø¨Ù„ Ø§Ù„Ø¥Ø±Ø³Ø§Ù„",
		walletChanged: "ØªÙ… ØªØºÙŠÙŠØ± Ø§Ù„Ø­Ø³Ø§Ø¨ Ø£Ùˆ Ø§Ù„Ø³Ù„Ø³Ù„Ø© Ø£Ø«Ù†Ø§Ø¡ Ø§Ù„ØªØ¯ÙÙ‚ â€” Ø¥Ù„ØºØ§Ø¡ (Ù„Ù… ÙŠØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ù…Ø¹Ø§Ù…Ù„Ø©)",
		noWallet: "Ù„Ù… ÙŠØªÙ… Ø§ÙƒØªØ´Ø§Ù Ù…Ø­ÙØ¸Ø©. Ù‚Ù… Ø¨ØªØ«Ø¨ÙŠØª MetaMask.", connectionRejected: "ØªÙ… Ø±ÙØ¶ Ø§Ù„Ø§ØªØµØ§Ù„: ",
		anotherBridge: "ØªØ¯ÙÙ‚ Ø¬Ø³Ø± Ø¢Ø®Ø± Ù‚ÙŠØ¯ Ø§Ù„ØªÙ†ÙÙŠØ°",
		forwardCompleted: "Ø§ÙƒØªÙ…Ù„ Ø§Ù„ØªØ­ÙˆÙŠÙ„ â€” Ø§Ù„Ø£Ù…ÙˆØ§Ù„ ÙÙŠ",
		attestationTimeout: "Ø§Ù†ØªÙ‡Øª Ù…Ù‡Ù„Ø© Ø§Ù„Ø´Ù‡Ø§Ø¯Ø© â€” Ø§Ù„Ø­Ø±Ù‚ Ù†Ø¬Ø­Ø› Ø£Ø¹Ø¯ Ù…Ø­Ø§ÙˆÙ„Ø© Ø§Ù„Ø³Ùƒ Ø¨Ø§Ù„Ù‡Ø§Ø´",
		forwardTimeout: "Ø§Ù†ØªÙ‡Øª Ù…Ù‡Ù„Ø© Ø§Ù„ØªØ­ÙˆÙŠÙ„ â€” Ø§Ù„Ø´Ù‡Ø§Ø¯Ø© Ù…ÙˆÙ‚Ø¹Ø©ØŒ Ø³Ùƒ ÙŠØ¯ÙˆÙŠ Ù…Ù…ÙƒÙ†",
		forwardTimeoutNoAtt: "Ø§Ù†ØªÙ‡Øª Ù…Ù‡Ù„Ø© Ø§Ù„ØªØ­ÙˆÙŠÙ„ â€” Ø§Ù„Ø´Ù‡Ø§Ø¯Ø© Ù„Ù… ØªÙÙˆÙ‚Ø¹ Ø¨Ø¹Ø¯Ø› Circle Ù‚Ø¯ ÙŠØ­ÙˆÙ„ Ø¨Ø¹Ø¯",
		usdcBridgingUnavailable: "Ø¬Ø³Ø± USDC ØºÙŠØ± Ù…ØªØ§Ø­ Ø¹Ù„Ù‰",
		bridgeNotDeployed: "Ø§Ù„Ø¬Ø³Ø± ØºÙŠØ± Ù…ÙÙ†Ø´Ø± Ø¹Ù„Ù‰",
		bridgeToken: "Ø¬Ø³Ø±", to: "Ø¥Ù„Ù‰",
		ethNotAvailable: "ETH ØºÙŠØ± Ù…ØªØ§Ø­ Ø¹Ù„Ù‰",
		ethOnlyEvm: "Ø¬Ø³Ø± ETH Ù…ØªØ§Ø­ ÙÙ‚Ø· Ø¹Ù„Ù‰ Ø³Ù„Ø§Ø³Ù„ EVM (Ù„ÙŠØ³ Arc)",
	},
	bn: {
		mainnet: "à¦®à§‡à¦‡à¦¨à¦¨à§‡à¦Ÿ", testnet: "à¦Ÿà§‡à¦¸à§à¦Ÿà¦¨à§‡à¦Ÿ", notConnected: "à¦¸à¦‚à¦¯à§à¦•à§à¦¤ à¦¨à¦¯à¦¼",
		connectWallet: "à¦“à¦¯à¦¼à¦¾à¦²à§‡à¦Ÿ à¦¸à¦‚à¦¯à§à¦•à§à¦¤ à¦•à¦°à§à¦¨", crossChainBridge: "à¦•à§à¦°à¦¸-à¦šà§‡à¦‡à¦¨ à¦¬à§à¦°à¦¿à¦œ",
		amount: "à¦ªà¦°à¦¿à¦®à¦¾à¦£", balance: "à¦¬à§à¦¯à¦¾à¦²à§‡à¦¨à§à¦¸", estGasFee: "à¦†à¦¨à§à¦®à¦¾à¦¨à¦¿à¦• à¦—à§à¦¯à¦¾à¦¸ à¦«à¦¿ (à¦‰à§Žà¦¸)",
		cctpFee: "CCTP à¦«à¦¾à¦¸à§à¦Ÿ-à¦Ÿà§à¦°à¦¾à¦¨à§à¦¸à¦«à¦¾à¦° à¦«à¦¿ (USDC)",
		forwardingService: "à¦«à¦°à¦“à¦¯à¦¼à¦¾à¦°à§à¦¡à¦¿à¦‚ à¦¸à¦¾à¦°à§à¦­à¦¿à¦¸ â€” Circle à¦†à¦ªà¦¨à¦¾à¦° à¦œà¦¨à§à¦¯ à¦®à¦¿à¦¨à§à¦Ÿ à¦œà¦®à¦¾ à¦¦à§‡à¦¯à¦¼ (à¦…à¦¤à¦¿à¦°à¦¿à¦•à§à¦¤ à¦«à¦¿, à¦—à¦¨à§à¦¤à¦¬à§à¦¯ à¦—à§à¦¯à¦¾à¦¸ à¦ªà§à¦°à¦¯à¦¼à§‹à¦œà¦¨ à¦¨à§‡à¦‡)",
		unfinishedBridge: "à¦…à¦¸à¦®à§à¦ªà§‚à¦°à§à¦£ à¦¬à§à¦°à¦¿à¦œ à¦¸à¦¨à¦¾à¦•à§à¦¤ à¦¹à¦¯à¦¼à§‡à¦›à§‡", resumeMint: "à¦®à¦¿à¦¨à§à¦Ÿ à¦ªà§à¦¨à¦°à¦¾à¦¯à¦¼ à¦¶à§à¦°à§ à¦•à¦°à§à¦¨",
		dismiss: "à¦¬à¦¾à¦¤à¦¿à¦²", burn: "à¦¬à¦¾à¦°à§à¦¨", attestation: "à¦…à§à¦¯à¦¾à¦Ÿà§‡à¦¸à§à¦Ÿà§‡à¦¶à¦¨", mint: "à¦®à¦¿à¦¨à§à¦Ÿ",
		enterAmount: "à¦ªà¦°à¦¿à¦®à¦¾à¦£ à¦²à¦¿à¦–à§à¦¨", cctpContracts: "CCTP V2 à¦•à¦¨à§à¦Ÿà§à¦°à§à¦¯à¦¾à¦•à§à¦Ÿ",
		estFee: "আনুমানিক ফি",
		estOutput: "আনুমানিক আউটপুট",
		estTime: "আনুমানিক সময়",
		relayDesc: "রিলে বিবরণ",
		route: "রুট",
		selectProtocol: "প্রোটোকল নির্বাচন করুন",
		txHistory: "à¦²à§‡à¦¨à¦¦à§‡à¦¨ à¦‡à¦¤à¦¿à¦¹à¦¾à¦¸", noTxs: "à¦à¦–à¦¨à§‹ à¦•à§‹à¦¨à§‹ à¦²à§‡à¦¨à¦¦à§‡à¦¨ à¦¨à§‡à¦‡",
		footerText: "WarpArc à¦¬à§à¦°à¦¿à¦œ Â· USDC Circle CCTP V2 à¦à¦° à¦®à¦¾à¦§à§à¦¯à¦®à§‡",
		systemStatus: "à¦¸à¦¿à¦¸à§à¦Ÿà§‡à¦® à¦¸à§à¦Ÿà§à¦¯à¦¾à¦Ÿà¦¾à¦¸", faucet: "à¦«à¦¸à§‡à¦Ÿ",
		sameChain: "à¦à¦•à¦‡ à¦šà§‡à¦‡à¦¨ à¦¨à¦¿à¦°à§à¦¬à¦¾à¦šà¦¿à¦¤", notDeployed: "à¦®à§‹à¦¤à¦¾à¦¯à¦¼à§‡à¦¨ à¦¹à¦¯à¦¼à¦¨à¦¿",
		approving: "USDC à¦…à¦¨à§à¦®à§‹à¦¦à¦¨ à¦¹à¦šà§à¦›à§‡...", burning: "à¦¬à¦¾à¦°à§à¦¨ à¦¹à¦šà§à¦›à§‡", waitingAttest: "à¦…à§à¦¯à¦¾à¦Ÿà§‡à¦¸à§à¦Ÿà§‡à¦¶à¦¨à§‡à¦° à¦œà¦¨à§à¦¯ à¦…à¦ªà§‡à¦•à§à¦·à¦¾...",
		minting: "à¦®à¦¿à¦¨à§à¦Ÿ à¦¹à¦šà§à¦›à§‡", waitingForward: "Circle à¦«à¦°à¦“à¦¯à¦¼à¦¾à¦°à§à¦¡à§‡à¦° à¦œà¦¨à§à¦¯ à¦…à¦ªà§‡à¦•à§à¦·à¦¾...",
		bridgeComplete: "à¦¬à§à¦°à¦¿à¦œ à¦¸à¦®à§à¦ªà§‚à¦°à§à¦£!", bridgeFailed: "à¦¬à§à¦°à¦¿à¦œ à¦¬à§à¦¯à¦°à§à¦¥: ",
		resumeFailed: "à¦ªà§à¦¨à¦°à¦¾à¦¯à¦¼ à¦¶à§à¦°à§ à¦¬à§à¦¯à¦°à§à¦¥: ", connectFirst: "à¦ªà§à¦°à¦¥à¦®à§‡ à¦†à¦ªà¦¨à¦¾à¦° à¦“à¦¯à¦¼à¦¾à¦²à§‡à¦Ÿ à¦¸à¦‚à¦¯à§à¦•à§à¦¤ à¦•à¦°à§à¦¨",
		enterValidAmount: "à¦à¦•à¦Ÿà¦¿ à¦¬à§ˆà¦§ à¦ªà¦°à¦¿à¦®à¦¾à¦£ à¦²à¦¿à¦–à§à¦¨", invalidAmount: "à¦…à¦¬à§ˆà¦§ à¦ªà¦°à¦¿à¦®à¦¾à¦£ à¦«à¦°à¦®à§à¦¯à¦¾à¦Ÿ",
		amountMustExceed0: "à¦ªà¦°à¦¿à¦®à¦¾à¦£ 0 à¦à¦° à¦¬à§‡à¦¶à¦¿ à¦¹à¦¤à§‡ à¦¹à¦¬à§‡", amountExceeds: "à¦ªà¦°à¦¿à¦®à¦¾à¦£ à¦†à¦ªà¦¨à¦¾à¦° à¦šà§‡à¦¯à¦¼à§‡ à¦¬à§‡à¦¶à¦¿",
		cctpUnavailable: "à¦à¦‡ à¦°à§à¦Ÿà§‡ CCTP à¦‰à¦ªà¦²à¦¬à§à¦§ à¦¨à¦¯à¦¼",
		networkMismatch: "à¦‰à§Žà¦¸ à¦à¦¬à¦‚ à¦—à¦¨à§à¦¤à¦¬à§à¦¯ à¦à¦•à¦‡ à¦¨à§‡à¦Ÿà¦“à¦¯à¦¼à¦¾à¦°à§à¦•à§‡ à¦¹à¦¤à§‡ à¦¹à¦¬à§‡ (à¦Ÿà§‡à¦¸à§à¦Ÿà¦¨à§‡à¦Ÿ/à¦®à§‡à¦‡à¦¨à¦¨à§‡à¦Ÿ)",
		forwardUnavailable: "à¦«à¦°à¦“à¦¯à¦¼à¦¾à¦°à§à¦¡à¦¿à¦‚ à¦«à¦¿ à¦•à§‹à¦Ÿ à¦‰à¦ªà¦²à¦¬à§à¦§ à¦¨à¦¯à¦¼ â€” à¦¸à¦¾à¦°à§à¦­à¦¿à¦¸ à¦¬à¦¨à§à¦§ à¦•à¦°à§à¦¨ à¦¬à¦¾ à¦†à¦¬à¦¾à¦° à¦šà§‡à¦·à§à¦Ÿà¦¾ à¦•à¦°à§à¦¨",
		amountMustExceedFee: "à¦ªà¦°à¦¿à¦®à¦¾à¦£ CCTP à¦«à¦¿ à¦à¦° à¦¬à§‡à¦¶à¦¿ à¦¹à¦¤à§‡ à¦¹à¦¬à§‡",
		switchingTo: "à¦“à¦¯à¦¼à¦¾à¦²à§‡à¦Ÿ à¦ªà¦°à¦¿à¦¬à¦°à§à¦¤à¦¨ à¦¹à¦šà§à¦›à§‡", alreadyRelayed: "à¦®à¦¿à¦¨à§à¦Ÿ à¦‡à¦¤à¦¿à¦®à¦§à§à¦¯à§‡ à¦°à¦¿à¦²à§‡à¦¯à¦¼à¦¾à¦° à¦¦à§à¦¬à¦¾à¦°à¦¾ à¦œà¦®à¦¾ à¦¦à§‡à¦“à¦¯à¦¼à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡ â€” à¦¤à¦¹à¦¬à¦¿à¦²",
		forwarderStalled: "à¦«à¦°à¦“à¦¯à¦¼à¦¾à¦°à§à¦¡à¦¾à¦° à¦¸à¦®à§à¦ªà§‚à¦°à§à¦£ à¦¹à¦¯à¦¼à¦¨à¦¿ â€” à¦®à§à¦¯à¦¾à¦¨à§à¦¯à¦¼à¦¾à¦² à¦®à¦¿à¦¨à§à¦Ÿ à¦šà¦²à¦›à§‡â€¦",
		resumeConfirm: "à¦à¦‡ à¦¬à¦¾à¦°à§à¦¨ à¦ªà§à¦°à¦¾à¦ªà¦•à§‡à¦° à¦œà¦¨à§à¦¯ à¦¤à§ˆà¦°à¦¿ à¦•à¦°à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à¦¿à¦²",
		notOnChain: "à¦“à¦¯à¦¼à¦¾à¦²à§‡à¦Ÿ à¦¨à§‡à¦‡", abortMint: " â€” à¦ªà¦¾à¦ à¦¾à¦¨à§‹à¦° à¦†à¦—à§‡ à¦®à¦¿à¦¨à§à¦Ÿ à¦¬à¦¾à¦¤à¦¿à¦²",
		walletChanged: "à¦«à§à¦²à§‹à¦° à¦¸à¦®à¦¯à¦¼ à¦…à§à¦¯à¦¾à¦•à¦¾à¦‰à¦¨à§à¦Ÿ à¦¬à¦¾ à¦šà§‡à¦‡à¦¨ à¦ªà¦°à¦¿à¦¬à¦°à§à¦¤à¦¿à¦¤ à¦¹à¦¯à¦¼à§‡à¦›à§‡ â€” à¦¬à¦¾à¦¤à¦¿à¦² (à¦•à§‹à¦¨à§‹ à¦²à§‡à¦¨à¦¦à§‡à¦¨ à¦œà¦®à¦¾ à¦¦à§‡à¦“à¦¯à¦¼à¦¾ à¦¹à¦¯à¦¼à¦¨à¦¿)",
		noWallet: "à¦•à§‹à¦¨à§‹ à¦“à¦¯à¦¼à¦¾à¦²à§‡à¦Ÿ à¦¸à¦¨à¦¾à¦•à§à¦¤ à¦¹à¦¯à¦¼à¦¨à¦¿à¥¤ MetaMask à¦‡à¦¨à¦¸à§à¦Ÿà¦² à¦•à¦°à§à¦¨à¥¤", connectionRejected: "à¦¸à¦‚à¦¯à§‹à¦— à¦ªà§à¦°à¦¤à§à¦¯à¦¾à¦–à§à¦¯à¦¾à¦¨: ",
		anotherBridge: "à¦†à¦°à§‡à¦•à¦Ÿà¦¿ à¦¬à§à¦°à¦¿à¦œ à¦«à§à¦²à§‹ à¦šà¦²à¦›à§‡",
		forwardCompleted: "à¦«à¦°à¦“à¦¯à¦¼à¦¾à¦°à§à¦¡ à¦¸à¦®à§à¦ªà§‚à¦°à§à¦£ â€” à¦¤à¦¹à¦¬à¦¿à¦²",
		attestationTimeout: "à¦…à§à¦¯à¦¾à¦Ÿà§‡à¦¸à§à¦Ÿà§‡à¦¶à¦¨ à¦Ÿà¦¾à¦‡à¦®à¦†à¦‰à¦Ÿ â€” à¦¬à¦¾à¦°à§à¦¨ à¦¸à¦«à¦²; à¦¹à§à¦¯à¦¾à¦¶ à¦¦à¦¿à¦¯à¦¼à§‡ à¦®à¦¿à¦¨à§à¦Ÿ à¦†à¦¬à¦¾à¦° à¦šà§‡à¦·à§à¦Ÿà¦¾ à¦•à¦°à§à¦¨",
		forwardTimeout: "à¦«à¦°à¦“à¦¯à¦¼à¦¾à¦°à§à¦¡ à¦¸à¦®à§à¦ªà§‚à¦°à§à¦£à¦¤à¦¾ à¦Ÿà¦¾à¦‡à¦®à¦†à¦‰à¦Ÿ â€” à¦…à§à¦¯à¦¾à¦Ÿà§‡à¦¸à§à¦Ÿà§‡à¦¶à¦¨ à¦¸à§à¦¬à¦¾à¦•à§à¦·à¦°à¦¿à¦¤, à¦®à§à¦¯à¦¾à¦¨à§à¦¯à¦¼à¦¾à¦² à¦®à¦¿à¦¨à§à¦Ÿ à¦¸à¦®à§à¦­à¦¬",
		forwardTimeoutNoAtt: "à¦«à¦°à¦“à¦¯à¦¼à¦¾à¦°à§à¦¡ à¦¸à¦®à§à¦ªà§‚à¦°à§à¦£à¦¤à¦¾ à¦Ÿà¦¾à¦‡à¦®à¦†à¦‰à¦Ÿ â€” à¦…à§à¦¯à¦¾à¦Ÿà§‡à¦¸à§à¦Ÿà§‡à¦¶à¦¨ à¦à¦–à¦¨à§‹ à¦¸à§à¦¬à¦¾à¦•à§à¦·à¦°à¦¿à¦¤ à¦¹à¦¯à¦¼à¦¨à¦¿; Circle à¦à¦–à¦¨à§‹ à¦«à¦°à¦“à¦¯à¦¼à¦¾à¦°à§à¦¡ à¦•à¦°à¦¤à§‡ à¦ªà¦¾à¦°à§‡",
		usdcBridgingUnavailable: "USDC à¦¬à§à¦°à¦¿à¦œà¦¿à¦‚ à¦‰à¦ªà¦²à¦¬à§à¦§ à¦¨à¦¯à¦¼",
		bridgeNotDeployed: "à¦¬à§à¦°à¦¿à¦œ à¦®à§‹à¦¤à¦¾à¦¯à¦¼à§‡à¦¨ à¦¹à¦¯à¦¼à¦¨à¦¿",
		bridgeToken: "à¦¬à§à¦°à¦¿à¦œ", to: "à¦¤à§‡",
		ethNotAvailable: "ETH à¦‰à¦ªà¦²à¦¬à§à¦§ à¦¨à¦¯à¦¼",
		ethOnlyEvm: "ETH à¦¬à§à¦°à¦¿à¦œà¦¿à¦‚ à¦¶à§à¦§à§à¦®à¦¾à¦¤à§à¦° EVM à¦šà§‡à¦‡à¦¨à§‡ à¦‰à¦ªà¦²à¦¬à§à¦§ (Arc à¦¨à¦¯à¦¼)",
	},
	pt: {
		mainnet: "Mainnet", testnet: "Testnet", notConnected: "NÃ£o conectado",
		connectWallet: "Conectar carteira", crossChainBridge: "Bridge cross-chain",
		estFee: "Taxa estimada",
		estOutput: "Saída estimada",
		estTime: "Tempo estimado",
		relayDesc: "Descrição do relé",
		route: "Rota",
		selectProtocol: "Selecionar protocolo",
		amount: "Valor", balance: "Saldo", estGasFee: "Taxa de gas estimada (origem)",
		cctpFee: "Taxa CCTP Fast-Transfer (USDC)",
		forwardingService: "ServiÃ§o de encaminhamento â€” Circle envia o mint para vocÃª (taxa extra, sem gas de destino)",
		unfinishedBridge: "Bridge incompleto detectado", resumeMint: "Retomar mint",
		dismiss: "Dispensar", burn: "Queima", attestation: "AttestaÃ§Ã£o", mint: "Mint",
		enterAmount: "Inserir valor", cctpContracts: "Contratos CCTP V2",
		txHistory: "HistÃ³rico de transaÃ§Ãµes", noTxs: "Nenhuma transaÃ§Ã£o ainda",
		footerText: "WarpArc Bridge Â· USDC via Circle CCTP V2",
		systemStatus: "Status do sistema", faucet: "Faucet",
		sameChain: "Mesma cadeia selecionada", notDeployed: "nÃ£o implantado",
		approving: "Aprovando USDC...", burning: "Queimando", waitingAttest: "Aguardando attestation...",
		minting: "Cunhando em", waitingForward: "Aguardando encaminhamento Circle...",
		bridgeComplete: "Bridge completo!", bridgeFailed: "Bridge falhou: ",
		resumeFailed: "Retomada falhou: ", connectFirst: "Conecte sua carteira primeiro",
		enterValidAmount: "Insira um valor vÃ¡lido", invalidAmount: "Formato de valor invÃ¡lido",
		amountMustExceed0: "O valor deve ser maior que 0", amountExceeds: "O valor excede seu",
		cctpUnavailable: "CCTP nÃ£o disponÃ­vel nesta rota",
		networkMismatch: "Origem e destino devem estar na mesma rede (testnet/mainnet)",
		forwardUnavailable: "CotaÃ§Ã£o de encaminhamento indisponÃ­vel â€” desative o serviÃ§o ou tente novamente",
		amountMustExceedFee: "O valor deve exceder a taxa CCTP",
		switchingTo: "Alternando carteira para", alreadyRelayed: "O mint jÃ¡ foi enviado por um relayer â€” fundos em",
		forwarderStalled: "Encaminhador nÃ£o completou â€” mint manual continuandoâ€¦",
		resumeConfirm: "Esta queima foi criada para o destinatÃ¡rio",
		notOnChain: "Carteira nÃ£o estÃ¡ em", abortMint: " â€” mint abortado antes de enviar",
		walletChanged: "Conta ou cadeia alterada durante o fluxo â€” abortando (nenhuma transaÃ§Ã£o enviada)",
		noWallet: "Nenhuma carteira detectada. Instale MetaMask.", connectionRejected: "ConexÃ£o rejeitada: ",
		anotherBridge: "Outro fluxo de bridge em andamento",
		forwardCompleted: "Encaminhamento completo â€” fundos em",
		attestationTimeout: "Timeout de attestation â€” queima bem-sucedida; tente mint com o hash",
		forwardTimeout: "Timeout de encaminhamento â€” attestation assinada, mint manual possÃ­vel",
		forwardTimeoutNoAtt: "Timeout de encaminhamento â€” attestation ainda nÃ£o assinada; Circle pode ainda encaminhar",
		usdcBridgingUnavailable: "Bridge USDC indisponÃ­vel em",
		bridgeNotDeployed: "Bridge nÃ£o implantado em",
		bridgeToken: "Bridge", to: "para",
		estFee: "Оценка комиссии",
		estOutput: "Оценка вывода",
		estTime: "Оценка времени",
		relayDesc: "Описание реле",
		route: "Маршрут",
		selectProtocol: "Выбрать протокол",
		ethNotAvailable: "ETH indisponÃ­vel em",
		ethOnlyEvm: "Bridge ETH disponÃ­vel apenas em cadeias EVM (nÃ£o Arc)",
	},
	ru: {
		mainnet: "ÐœÐµÐ¹Ð½Ð½ÐµÑ‚", testnet: "Ð¢ÐµÑÑ‚Ð½ÐµÑ‚", notConnected: "ÐÐµ Ð¿Ð¾Ð´ÐºÐ»ÑŽÑ‡ÐµÐ½Ð¾",
		connectWallet: "ÐŸÐ¾Ð´ÐºÐ»ÑŽÑ‡Ð¸Ñ‚ÑŒ ÐºÐ¾ÑˆÐµÐ»Ñ‘Ðº", crossChainBridge: "ÐšÑ€Ð¾ÑÑ-Ñ‡ÐµÐ¹Ð½ Ð¼Ð¾ÑÑ‚",
		amount: "Ð¡ÑƒÐ¼Ð¼Ð°", balance: "Ð‘Ð°Ð»Ð°Ð½Ñ", estGasFee: "ÐžÑ†ÐµÐ½ÐºÐ° ÐºÐ¾Ð¼Ð¸ÑÑÐ¸Ð¸ Ð³Ð°Ð·Ð° (Ð¸ÑÑ‚Ð¾Ñ‡Ð½Ð¸Ðº)",
		cctpFee: "ÐšÐ¾Ð¼Ð¸ÑÑÐ¸Ñ CCTP Fast-Transfer (USDC)",
		forwardingService: "Ð¡ÐµÑ€Ð²Ð¸Ñ Ð¿ÐµÑ€ÐµÑÑ‹Ð»ÐºÐ¸ â€” Circle Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð¸Ñ‚ Ð¼Ð¸Ð½Ñ‚ Ð·Ð° Ð²Ð°Ñ (Ð´Ð¾Ð¿. ÐºÐ¾Ð¼Ð¸ÑÑÐ¸Ñ, Ð³Ð°Ð· Ð½Ð°Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ñ Ð½Ðµ Ð½ÑƒÐ¶ÐµÐ½)",
		unfinishedBridge: "ÐžÐ±Ð½Ð°Ñ€ÑƒÐ¶ÐµÐ½ Ð½ÐµÐ·Ð°Ð²ÐµÑ€ÑˆÑ‘Ð½Ð½Ñ‹Ð¹ Ð¼Ð¾ÑÑ‚", resumeMint: "Ð’Ð¾Ð·Ð¾Ð±Ð½Ð¾Ð²Ð¸Ñ‚ÑŒ Ð¼Ð¸Ð½Ñ‚",
		dismiss: "Ð—Ð°ÐºÑ€Ñ‹Ñ‚ÑŒ", burn: "Ð¡Ð¶Ð¸Ð³Ð°Ð½Ð¸Ðµ", attestation: "ÐÑ‚Ñ‚ÐµÑÑ‚Ð°Ñ†Ð¸Ñ", mint: "ÐœÐ¸Ð½Ñ‚",
		enterAmount: "Ð’Ð²ÐµÐ´Ð¸Ñ‚Ðµ ÑÑƒÐ¼Ð¼Ñƒ", cctpContracts: "ÐšÐ¾Ð½Ñ‚Ñ€Ð°ÐºÑ‚Ñ‹ CCTP V2",
		txHistory: "Ð˜ÑÑ‚Ð¾Ñ€Ð¸Ñ Ñ‚Ñ€Ð°Ð½Ð·Ð°ÐºÑ†Ð¸Ð¹", noTxs: "Ð¢Ñ€Ð°Ð½Ð·Ð°ÐºÑ†Ð¸Ð¹ Ð¿Ð¾ÐºÐ° Ð½ÐµÑ‚",
		footerText: "WarpArc Bridge Â· USDC Ñ‡ÐµÑ€ÐµÐ· Circle CCTP V2",
		systemStatus: "Ð¡Ñ‚Ð°Ñ‚ÑƒÑ ÑÐ¸ÑÑ‚ÐµÐ¼Ñ‹", faucet: "ÐšÑ€Ð°Ð½",
		sameChain: "Ð’Ñ‹Ð±Ñ€Ð°Ð½Ð° Ñ‚Ð° Ð¶Ðµ ÑÐµÑ‚ÑŒ", notDeployed: "Ð½Ðµ Ñ€Ð°Ð·Ð²Ñ‘Ñ€Ð½ÑƒÑ‚",
		approving: "ÐžÐ´Ð¾Ð±Ñ€ÐµÐ½Ð¸Ðµ USDC...", burning: "Ð¡Ð¶Ð¸Ð³Ð°Ð½Ð¸Ðµ", waitingAttest: "ÐžÐ¶Ð¸Ð´Ð°Ð½Ð¸Ðµ Ð°Ñ‚Ñ‚ÐµÑÑ‚Ð°Ñ†Ð¸Ð¸...",
		minting: "ÐœÐ¸Ð½Ñ‚ Ð½Ð°", waitingForward: "ÐžÐ¶Ð¸Ð´Ð°Ð½Ð¸Ðµ Ð¿ÐµÑ€ÐµÑÑ‹Ð»ÐºÐ¸ Circle...",
		bridgeComplete: "ÐœÐ¾ÑÑ‚ Ð·Ð°Ð²ÐµÑ€ÑˆÑ‘Ð½!", bridgeFailed: "ÐœÐ¾ÑÑ‚ Ð½Ðµ ÑƒÐ´Ð°Ð»ÑÑ: ",
		resumeFailed: "Ð’Ð¾Ð·Ð¾Ð±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ðµ Ð½Ðµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ: ", connectFirst: "Ð¡Ð½Ð°Ñ‡Ð°Ð»Ð° Ð¿Ð¾Ð´ÐºÐ»ÑŽÑ‡Ð¸Ñ‚Ðµ ÐºÐ¾ÑˆÐµÐ»Ñ‘Ðº",
		enterValidAmount: "Ð’Ð²ÐµÐ´Ð¸Ñ‚Ðµ Ð´Ð¾Ð¿ÑƒÑÑ‚Ð¸Ð¼ÑƒÑŽ ÑÑƒÐ¼Ð¼Ñƒ", invalidAmount: "ÐÐµÐ²ÐµÑ€Ð½Ñ‹Ð¹ Ñ„Ð¾Ñ€Ð¼Ð°Ñ‚ ÑÑƒÐ¼Ð¼Ñ‹",
		amountMustExceed0: "Ð¡ÑƒÐ¼Ð¼Ð° Ð´Ð¾Ð»Ð¶Ð½Ð° Ð±Ñ‹Ñ‚ÑŒ Ð±Ð¾Ð»ÑŒÑˆÐµ 0", amountExceeds: "Ð¡ÑƒÐ¼Ð¼Ð° Ð¿Ñ€ÐµÐ²Ñ‹ÑˆÐ°ÐµÑ‚ Ð²Ð°Ñˆ",
		cctpUnavailable: "CCTP Ð½ÐµÐ´Ð¾ÑÑ‚ÑƒÐ¿ÐµÐ½ Ð½Ð° ÑÑ‚Ð¾Ð¼ Ð¼Ð°Ñ€ÑˆÑ€ÑƒÑ‚Ðµ",
		networkMismatch: "Ð˜ÑÑ‚Ð¾Ñ‡Ð½Ð¸Ðº Ð¸ Ð½Ð°Ð·Ð½Ð°Ñ‡ÐµÐ½Ð¸Ðµ Ð´Ð¾Ð»Ð¶Ð½Ñ‹ Ð±Ñ‹Ñ‚ÑŒ Ð² Ð¾Ð´Ð½Ð¾Ð¹ ÑÐµÑ‚Ð¸ (Ñ‚ÐµÑÑ‚Ð½ÐµÑ‚/Ð¼ÐµÐ¹Ð½Ð½ÐµÑ‚)",
		forwardUnavailable: "ÐšÐ¾Ñ‚Ð¸Ñ€Ð¾Ð²ÐºÐ° Ð¿ÐµÑ€ÐµÑÑ‹Ð»ÐºÐ¸ Ð½ÐµÐ´Ð¾ÑÑ‚ÑƒÐ¿Ð½Ð° â€” Ð¾Ñ‚ÐºÐ»ÑŽÑ‡Ð¸Ñ‚Ðµ ÑÐµÑ€Ð²Ð¸Ñ Ð¸Ð»Ð¸ Ð¿Ð¾Ð²Ñ‚Ð¾Ñ€Ð¸Ñ‚Ðµ",
		amountMustExceedFee: "Ð¡ÑƒÐ¼Ð¼Ð° Ð´Ð¾Ð»Ð¶Ð½Ð° Ð¿Ñ€ÐµÐ²Ñ‹ÑˆÐ°Ñ‚ÑŒ ÐºÐ¾Ð¼Ð¸ÑÑÐ¸ÑŽ CCTP",
		switchingTo: "ÐŸÐµÑ€ÐµÐºÐ»ÑŽÑ‡ÐµÐ½Ð¸Ðµ ÐºÐ¾ÑˆÐµÐ»ÑŒÐºÐ° Ð½Ð°", alreadyRelayed: "ÐœÐ¸Ð½Ñ‚ ÑƒÐ¶Ðµ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½ Ñ€ÐµÐ»ÐµÐµÑ€Ð¾Ð¼ â€” ÑÑ€ÐµÐ´ÑÑ‚Ð²Ð° Ð½Ð°",
		forwarderStalled: "ÐŸÐµÑ€ÐµÑÑ‹Ð»ÐºÐ° Ð½Ðµ Ð·Ð°Ð²ÐµÑ€ÑˆÐµÐ½Ð° â€” Ñ€ÑƒÑ‡Ð½Ð¾Ð¹ Ð¼Ð¸Ð½Ñ‚ Ð¿Ñ€Ð¾Ð´Ð¾Ð»Ð¶Ð°ÐµÑ‚ÑÑâ€¦",
		resumeConfirm: "Ð­Ñ‚Ð¾ ÑÐ¶Ð¸Ð³Ð°Ð½Ð¸Ðµ Ð±Ñ‹Ð»Ð¾ ÑÐ¾Ð·Ð´Ð°Ð½Ð¾ Ð´Ð»Ñ Ð¿Ð¾Ð»ÑƒÑ‡Ð°Ñ‚ÐµÐ»Ñ",
		notOnChain: "ÐšÐ¾ÑˆÐµÐ»Ñ‘Ðº Ð½Ðµ Ð½Ð°", abortMint: " â€” Ð¼Ð¸Ð½Ñ‚ Ð¾Ñ‚Ð¼ÐµÐ½Ñ‘Ð½ Ð¿ÐµÑ€ÐµÐ´ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²ÐºÐ¾Ð¹",
		walletChanged: "ÐÐºÐºÐ°ÑƒÐ½Ñ‚ Ð¸Ð»Ð¸ ÑÐµÑ‚ÑŒ Ð¸Ð·Ð¼ÐµÐ½Ð¸Ð»Ð¸ÑÑŒ Ð²Ð¾ Ð²Ñ€ÐµÐ¼Ñ Ð¿Ñ€Ð¾Ñ†ÐµÑÑÐ° â€” Ð¾Ñ‚Ð¼ÐµÐ½Ð° (Ñ‚Ñ€Ð°Ð½Ð·Ð°ÐºÑ†Ð¸Ñ Ð½Ðµ Ð¾Ñ‚Ð¿Ñ€Ð°Ð²Ð»ÐµÐ½Ð°)",
		noWallet: "ÐšÐ¾ÑˆÐµÐ»Ñ‘Ðº Ð½Ðµ Ð¾Ð±Ð½Ð°Ñ€ÑƒÐ¶ÐµÐ½. Ð£ÑÑ‚Ð°Ð½Ð¾Ð²Ð¸Ñ‚Ðµ MetaMask.", connectionRejected: "ÐŸÐ¾Ð´ÐºÐ»ÑŽÑ‡ÐµÐ½Ð¸Ðµ Ð¾Ñ‚ÐºÐ»Ð¾Ð½ÐµÐ½Ð¾: ",
		anotherBridge: "Ð”Ñ€ÑƒÐ³Ð¾Ð¹ Ð¿Ñ€Ð¾Ñ†ÐµÑÑ Ð¼Ð¾ÑÑ‚Ð° Ð²Ñ‹Ð¿Ð¾Ð»Ð½ÑÐµÑ‚ÑÑ",
		forwardCompleted: "ÐŸÐµÑ€ÐµÑÑ‹Ð»ÐºÐ° Ð·Ð°Ð²ÐµÑ€ÑˆÐµÐ½Ð° â€” ÑÑ€ÐµÐ´ÑÑ‚Ð²Ð° Ð½Ð°",
		estFee: "推定手数料",
		estOutput: "推定出力",
		estTime: "推定時間",
		relayDesc: "リレーの説明",
		route: "ルート",
		selectProtocol: "プロトコルを選択",
		attestationTimeout: "Ð¢Ð°Ð¹Ð¼Ð°ÑƒÑ‚ Ð°Ñ‚Ñ‚ÐµÑÑ‚Ð°Ñ†Ð¸Ð¸ â€” ÑÐ¶Ð¸Ð³Ð°Ð½Ð¸Ðµ ÑƒÑÐ¿ÐµÑˆÐ½Ð¾; Ð¿Ð¾Ð²Ñ‚Ð¾Ñ€Ð¸Ñ‚Ðµ Ð¼Ð¸Ð½Ñ‚ Ñ Ñ…ÐµÑˆÐµÐ¼",
		forwardTimeout: "Ð¢Ð°Ð¹Ð¼Ð°ÑƒÑ‚ Ð¿ÐµÑ€ÐµÑÑ‹Ð»ÐºÐ¸ â€” Ð°Ñ‚Ñ‚ÐµÑÑ‚Ð°Ñ†Ð¸Ñ Ð¿Ð¾Ð´Ð¿Ð¸ÑÐ°Ð½Ð°, Ñ€ÑƒÑ‡Ð½Ð¾Ð¹ Ð¼Ð¸Ð½Ñ‚ Ð²Ð¾Ð·Ð¼Ð¾Ð¶ÐµÐ½",
		forwardTimeoutNoAtt: "Ð¢Ð°Ð¹Ð¼Ð°ÑƒÑ‚ Ð¿ÐµÑ€ÐµÑÑ‹Ð»ÐºÐ¸ â€” Ð°Ñ‚Ñ‚ÐµÑÑ‚Ð°Ñ†Ð¸Ñ ÐµÑ‰Ñ‘ Ð½Ðµ Ð¿Ð¾Ð´Ð¿Ð¸ÑÐ°Ð½Ð°; Circle Ð¼Ð¾Ð¶ÐµÑ‚ ÐµÑ‰Ñ‘ Ð¿ÐµÑ€ÐµÑÐ»Ð°Ñ‚ÑŒ",
		usdcBridgingUnavailable: "ÐœÐ¾ÑÑ‚ USDC Ð½ÐµÐ´Ð¾ÑÑ‚ÑƒÐ¿ÐµÐ½ Ð½Ð°",
		bridgeNotDeployed: "ÐœÐ¾ÑÑ‚ Ð½Ðµ Ñ€Ð°Ð·Ð²Ñ‘Ñ€Ð½ÑƒÑ‚ Ð½Ð°",
		bridgeToken: "ÐœÐ¾ÑÑ‚", to: "Ð½Ð°",
		ethNotAvailable: "ETH Ð½ÐµÐ´Ð¾ÑÑ‚ÑƒÐ¿ÐµÐ½ Ð½Ð°",
		ethOnlyEvm: "ÐœÐ¾ÑÑ‚ ETH Ð´Ð¾ÑÑ‚ÑƒÐ¿ÐµÐ½ Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð½Ð° EVM-Ñ†ÐµÐ¿ÑÑ… (Ð½Ðµ Arc)",
	},
	ja: {
		mainnet: "ãƒ¡ã‚¤ãƒ³ãƒãƒƒãƒˆ", testnet: "ãƒ†ã‚¹ãƒˆãƒãƒƒãƒˆ", notConnected: "æœªæŽ¥ç¶š",
		connectWallet: "ã‚¦ã‚©ãƒ¬ãƒƒãƒˆæŽ¥ç¶š", crossChainBridge: "ã‚¯ãƒ­ã‚¹ãƒã‚§ãƒ¼ãƒ³ãƒ–ãƒªãƒƒã‚¸",
		amount: "é‡‘é¡", balance: "æ®‹é«˜", estGasFee: "æŽ¨å®šã‚¬ã‚¹ä»£ï¼ˆé€ä¿¡å…ƒï¼‰",
		cctpFee: "CCTPé«˜é€Ÿè»¢é€æ‰‹æ•°æ–™ï¼ˆUSDCï¼‰",
		forwardingService: "ãƒ•ã‚©ãƒ¯ãƒ¼ãƒ‡ã‚£ãƒ³ã‚°ã‚µãƒ¼ãƒ“ã‚¹ â€” CircleãŒãƒŸãƒ³ãƒˆã‚’é€ä¿¡ï¼ˆè¿½åŠ æ‰‹æ•°æ–™ã€å®›å…ˆã‚¬ã‚¹ä¸è¦ï¼‰",
		unfinishedBridge: "æœªå®Œäº†ã®ãƒ–ãƒªãƒƒã‚¸ã‚’æ¤œå‡º", resumeMint: "ãƒŸãƒ³ãƒˆå†é–‹",
		dismiss: "é–‰ã˜ã‚‹", burn: "ãƒãƒ¼ãƒ³", attestation: "ã‚¢ãƒ†ã‚¹ãƒ†ãƒ¼ã‚·ãƒ§ãƒ³", mint: "ãƒŸãƒ³ãƒˆ",
		enterAmount: "é‡‘é¡ã‚’å…¥åŠ›", cctpContracts: "CCTP V2ã‚³ãƒ³ãƒˆãƒ©ã‚¯ãƒˆ",
		txHistory: "å–å¼•å±¥æ­´", noTxs: "å–å¼•ãªã—",
		footerText: "WarpArcãƒ–ãƒªãƒƒã‚¸ Â· USDCï¼ˆCircle CCTP V2çµŒç”±ï¼‰",
		systemStatus: "ã‚·ã‚¹ãƒ†ãƒ ã‚¹ãƒ†ãƒ¼ã‚¿ã‚¹", faucet: "ãƒ•ã‚©ãƒ¼ã‚»ãƒƒãƒˆ",
		sameChain: "åŒã˜ãƒã‚§ãƒ¼ãƒ³ãŒé¸æŠžã•ã‚Œã¦ã„ã¾ã™", notDeployed: "æœªãƒ‡ãƒ—ãƒ­ã‚¤",
		approving: "USDCæ‰¿èªä¸­...", burning: "ãƒãƒ¼ãƒ³ä¸­", waitingAttest: "ã‚¢ãƒ†ã‚¹ãƒ†ãƒ¼ã‚·ãƒ§ãƒ³å¾…ã¡...",
		minting: "ãƒŸãƒ³ãƒˆä¸­", waitingForward: "Circleãƒ•ã‚©ãƒ¯ãƒ¼ãƒ‰å¾…ã¡...",
		bridgeComplete: "ãƒ–ãƒªãƒƒã‚¸å®Œäº†ï¼", bridgeFailed: "ãƒ–ãƒªãƒƒã‚¸å¤±æ•—: ",
		resumeFailed: "å†é–‹å¤±æ•—: ", connectFirst: "å…ˆã«ã‚¦ã‚©ãƒ¬ãƒƒãƒˆã‚’æŽ¥ç¶šã—ã¦ãã ã•ã„",
		enterValidAmount: "æœ‰åŠ¹ãªé‡‘é¡ã‚’å…¥åŠ›", invalidAmount: "ç„¡åŠ¹ãªé‡‘é¡å½¢å¼",
		amountMustExceed0: "é‡‘é¡ã¯0ã‚ˆã‚Šå¤§ãã„å¿…è¦ãŒã‚ã‚Šã¾ã™", amountExceeds: "é‡‘é¡ãŒæ®‹é«˜ã‚’è¶…ãˆã¦ã„ã¾ã™",
		cctpUnavailable: "ã“ã®ãƒ«ãƒ¼ãƒˆã§CCTPã¯åˆ©ç”¨ã§ãã¾ã›ã‚“",
		networkMismatch: "é€ä¿¡å…ƒã¨å®›å…ˆã¯åŒã˜ãƒãƒƒãƒˆãƒ¯ãƒ¼ã‚¯ã§ã‚ã‚‹å¿…è¦ãŒã‚ã‚Šã¾ã™ï¼ˆãƒ†ã‚¹ãƒˆãƒãƒƒãƒˆ/ãƒ¡ã‚¤ãƒ³ãƒãƒƒãƒˆï¼‰",
		forwardUnavailable: "ãƒ•ã‚©ãƒ¯ãƒ¼ãƒ‡ã‚£ãƒ³ã‚°æ‰‹æ•°æ–™ã®è¦‹ç©ã‚‚ã‚Šä¸å¯ â€” ã‚µãƒ¼ãƒ“ã‚¹ã‚’ã‚ªãƒ•ã«ã™ã‚‹ã‹å†è©¦è¡Œ",
		amountMustExceedFee: "é‡‘é¡ã¯CCTPæ‰‹æ•°æ–™ã‚’è¶…ãˆã‚‹å¿…è¦ãŒã‚ã‚Šã¾ã™",
		switchingTo: "ã‚¦ã‚©ãƒ¬ãƒƒãƒˆåˆ‡ã‚Šæ›¿ãˆä¸­", alreadyRelayed: "ãƒŸãƒ³ãƒˆã¯ãƒªãƒ¬ã‚¤ãƒ¤ãƒ¼ã«ã‚ˆã‚Šé€ä¿¡æ¸ˆã¿ â€” è³‡é‡‘ã¯",
		forwarderStalled: "ãƒ•ã‚©ãƒ¯ãƒ¼ãƒ€ãƒ¼æœªå®Œäº† â€” æ‰‹å‹•ãƒŸãƒ³ãƒˆç¶šè¡Œâ€¦",
		resumeConfirm: "ã“ã®ãƒãƒ¼ãƒ³ã¯å—å–äººå‘ã‘ã«ä½œæˆã•ã‚Œã¾ã—ãŸ",
		notOnChain: "ã‚¦ã‚©ãƒ¬ãƒƒãƒˆãŒä¸Šã«ã‚ã‚Šã¾ã›ã‚“", abortMint: " â€” é€ä¿¡å‰ã«ãƒŸãƒ³ãƒˆä¸­æ­¢",
		walletChanged: "ãƒ•ãƒ­ãƒ¼ä¸­ã«ã‚¢ã‚«ã‚¦ãƒ³ãƒˆã¾ãŸã¯ãƒã‚§ãƒ¼ãƒ³ãŒå¤‰æ›´ â€” ä¸­æ­¢ï¼ˆãƒˆãƒ©ãƒ³ã‚¶ã‚¯ã‚·ãƒ§ãƒ³æœªé€ä¿¡ï¼‰",
		noWallet: "ã‚¦ã‚©ãƒ¬ãƒƒãƒˆãŒæ¤œå‡ºã•ã‚Œã¾ã›ã‚“ã€‚MetaMaskã‚’ã‚¤ãƒ³ã‚¹ãƒˆãƒ¼ãƒ«ã—ã¦ãã ã•ã„ã€‚", connectionRejected: "æŽ¥ç¶šæ‹’å¦: ",
		anotherBridge: "åˆ¥ã®ãƒ–ãƒªãƒƒã‚¸ãƒ•ãƒ­ãƒ¼ãŒé€²è¡Œä¸­",
		forwardCompleted: "ãƒ•ã‚©ãƒ¯ãƒ¼ãƒ‰å®Œäº† â€” è³‡é‡‘ã¯",
		attestationTimeout: "ã‚¢ãƒ†ã‚¹ãƒ†ãƒ¼ã‚·ãƒ§ãƒ³ã‚¿ã‚¤ãƒ ã‚¢ã‚¦ãƒˆ â€” ãƒãƒ¼ãƒ³æˆåŠŸï¼›ãƒãƒƒã‚·ãƒ¥ã§ãƒŸãƒ³ãƒˆå†è©¦è¡Œå¯èƒ½",
		forwardTimeout: "ãƒ•ã‚©ãƒ¯ãƒ¼ãƒ‰å®Œäº†ã‚¿ã‚¤ãƒ ã‚¢ã‚¦ãƒˆ â€” ã‚¢ãƒ†ã‚¹ãƒ†ãƒ¼ã‚·ãƒ§ãƒ³ç½²åæ¸ˆã¿ã€æ‰‹å‹•ãƒŸãƒ³ãƒˆå¯èƒ½",
		forwardTimeoutNoAtt: "ãƒ•ã‚©ãƒ¯ãƒ¼ãƒ‰å®Œäº†ã‚¿ã‚¤ãƒ ã‚¢ã‚¦ãƒˆ â€” ã‚¢ãƒ†ã‚¹ãƒ†ãƒ¼ã‚·ãƒ§ãƒ³æœªç½²åï¼›CircleãŒãƒ•ã‚©ãƒ¯ãƒ¼ãƒ‰ã™ã‚‹å¯èƒ½æ€§ã‚ã‚Š",
		usdcBridgingUnavailable: "USDCãƒ–ãƒªãƒƒã‚¸ã¯åˆ©ç”¨ã§ãã¾ã›ã‚“",
		bridgeNotDeployed: "ãƒ–ãƒªãƒƒã‚¸æœªãƒ‡ãƒ—ãƒ­ã‚¤",
		bridgeToken: "ãƒ–ãƒªãƒƒã‚¸", to: "ã¸",
		ethNotAvailable: "ETHã¯åˆ©ç”¨ã§ãã¾ã›ã‚“",
		ethOnlyEvm: "ETHãƒ–ãƒªãƒƒã‚¸ã¯EVMãƒã‚§ãƒ¼ãƒ³ã§ã®ã¿åˆ©ç”¨å¯èƒ½ï¼ˆArcã¯ä¸å¯ï¼‰",
	},
};

const LANG_META = {
	en: { flag: "EN", label: "English" },
	zh: { flag: "ZH", label: "ä¸­æ–‡" },
	hi: { flag: "HI", label: "à¤¹à¤¿à¤¨à¥à¤¦à¥€" },
	es: { flag: "ES", label: "EspaÃ±ol" },
	fr: { flag: "FR", label: "FranÃ§ais" },
	ar: { flag: "AR", label: "Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©" },
	bn: { flag: "BN", label: "à¦¬à¦¾à¦‚à¦²à¦¾" },
	pt: { flag: "PT", label: "PortuguÃªs" },
	ru: { flag: "RU", label: "Ð ÑƒÑÑÐºÐ¸Ð¹" },
	ja: { flag: "JA", label: "æ—¥æœ¬èªž" },
};

let currentLang = "en";

function t(key) {
	const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
	return (dict && dict[key]) || TRANSLATIONS.en[key] || key;
}

function applyTranslations() {
	document.querySelectorAll("[data-i18n]").forEach((node) => {
		const key = node.getAttribute("data-i18n");
		const translated = t(key);
		if (translated) node.textContent = translated;
	});
	// Update html lang attribute
	document.documentElement.lang = currentLang;
	// Update lang button flag
	const flagEl = document.getElementById("lang-flag");
	if (flagEl && LANG_META[currentLang]) flagEl.textContent = LANG_META[currentLang].flag;
	// Mark active option
	document.querySelectorAll(".lang-option").forEach((opt) => {
		opt.classList.toggle("active", opt.getAttribute("data-lang") === currentLang);
	});
	// RTL for Arabic
	if (currentLang === "ar") {
		document.documentElement.dir = "rtl";
	} else {
		document.documentElement.dir = "ltr";
	}
}

function setLanguage(lang) {
	if (!TRANSLATIONS[lang]) return;
	currentLang = lang;
	try { localStorage.setItem(LANG_KEY, lang); } catch {}
	applyTranslations();
}

function initLanguage() {
	try {
		const saved = localStorage.getItem(LANG_KEY);
		if (saved && TRANSLATIONS[saved]) {
			currentLang = saved;
		} else {
			// Auto-detect from browser
			const browserLang = (navigator.language || "").slice(0, 2).toLowerCase();
			if (TRANSLATIONS[browserLang]) currentLang = browserLang;
		}
	} catch {}
	applyTranslations();
}

const HISTORY_KEY = "warparc:txHistory";
const PENDING_KEY = "warparc:pendingCctp";
// Saved wallet pick â€” {type:"injected",rdns,label} | {type:"walletconnect"} â€”
// so a reload can reconnect silently (see autoReconnect).
const WALLET_PREF_KEY = "warparc:walletPref";
// rdns wallets.js registers for the legacy injected fallback. Built by
// concatenation so app.js never carries an injectable-provider-looking token.
const LEGACY_WALLET_RDNS = "legacy.window." + "ethereum";

const state = {
	provider: null,
	signer: null,
	account: null,
	chainId: null,
	lastFromBalanceRaw: null,
	isConnecting: false,
	isBridging: false,
	// Default to Testnet â€” Arc is testnet-only until public mainnet (Sep 16, 2026)
	testnetMode: true,
	txHistory: [],
	// Active connection: { eip1193, type:"injected"|"walletconnect", label }.
	wallet: null,
	// Event-binding bookkeeping for bindWalletEvents (internal).
	_eventsBound: false,
	_boundProvider: null,
	_accountsChanged: null,
	_chainChanged: null
};

const el = (id) => document.getElementById(id);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const toast = (msg, type = "info") => {
	const c = el("toast-container");
	const t = document.createElement("div");
	t.className = `toast ${type}`;
	t.textContent = msg;
	c.appendChild(t);
	setTimeout(() => t.remove(), 4000);
};

const shortAddr = (a) => a.slice(0, 6) + "â€¦" + a.slice(-4);

// --- Protocol Selector (Relay / Li.Fi / CCTP) --------------------------------

const PROTOCOL_KEY = "warparc:protocol";

const PROTOCOLS = {
	relay: {
		name: "Relay",
		icon: "âš¡",
		fee: "0%",
		speed: "<3s",
		chains: "85+",
		desc: "Fastest cross-chain bridge. Intent-based, p50 &lt;3s fill time. 0% fee for ETHâ†’ETH. USDC also supported.",
		apiBase: "https://api.relay.link",
		testnetApiBase: "https://api.testnets.relay.link",
		supportedTokens: ["ETH", "USDC"],
	},
	lifi: {
		name: "Li.Fi",
		icon: "ðŸ”—",
		fee: "0.25%",
		speed: "~30s",
		chains: "60+",
		desc: "Bridge aggregator routing through 20+ bridges for best rates. Supports ETH and USDC.",
		apiBase: "https://li.quest/v1",
		supportedTokens: ["ETH", "USDC"],
	},
	cctp: {
		name: "CCTP V2",
		icon: "ðŸ”µ",
		fee: "~$0.10",
		speed: "~15min",
		chains: "5",
		desc: "Circle's native USDC bridge. Burn-and-mint, no wrapped tokens. Canonical route for Arc only.",
		supportedTokens: ["USDC"],
	},
	across: {
		name: "Across",
		icon: "â›“ï¸",
		fee: "~0.05%",
		speed: "~2s",
		chains: "24+",
		desc: "Fastest cross-chain (~2s fills). Uses optimistic relayers. ETH and USDC supported.",
		apiBase: "https://app.across.to/api",
		supportedTokens: ["ETH", "USDC"],
	},
	stargateV2: {
		name: "Stargate V2",
		icon: "âš¡",
		fee: "~0.06%",
		speed: "~2min",
		chains: "15+",
		desc: "LayerZero-based unified liquidity. Native ETH via Router contract.",
		supportedTokens: ["ETH"],
	},
	socket: {
		name: "Socket/Bungee",
		icon: "ðŸ”Œ",
		fee: "~0.2%",
		speed: "~1min",
		chains: "30+",
		desc: "Cross-chain routing engine aggregating bridges and DEXs. Refuel feature.",
		apiBase: "https://public-backend.socket.tech/v3",
		supportedTokens: ["ETH"],
	},
};

let selectedProtocol = "relay";

function getSelectedProtocol() {
	return selectedProtocol;
}

function setProtocol(proto) {
	if (!PROTOCOLS[proto]) return;
	selectedProtocol = proto;
	try { localStorage.setItem(PROTOCOL_KEY, proto); } catch {}
	updateProtocolUI();
	// Re-quote when protocol changes
	if (state.account) estimateGas();
}

function initProtocol() {
	try {
		const saved = localStorage.getItem(PROTOCOL_KEY);
		if (saved && PROTOCOLS[saved]) selectedProtocol = saved;
	} catch {}
	updateProtocolUI();
}

function updateProtocolUI() {
	const proto = PROTOCOLS[selectedProtocol];
	if (!proto) return;

	// Update badge
	const badge = el("protocol-badge");
	if (badge) badge.textContent = proto.name;

	// Check if ARC is involved in current route
	const fromKey = el("from-chain")?.value;
	const toKey = el("to-chain")?.value;
	const isArcRoute = fromKey === "arc" || fromKey === "arcMainnet" || toKey === "arc" || toKey === "arcMainnet";
	const token = getSelectedToken();

	// Show/hide CCTP option based on route
	const cctpRow = el("proto-cctp");
	if (cctpRow) {
		// CCTP only for USDC + ARC routes
		cctpRow.style.display = (token === "USDC" && isArcRoute) ? "grid" : "none";
	}

	// Auto-select CCTP for ARC routes, or switch away from CCTP for non-ARC
	if (token === "USDC" && isArcRoute && selectedProtocol !== "cctp") {
		setProtocol("cctp");
		return;
	} else if (!isArcRoute && selectedProtocol === "cctp") {
		setProtocol("relay"); // default to relay for non-ARC
		return;
	}

	// Update active state
	document.querySelectorAll(".protocol-row[data-protocol]").forEach((row) => {
		row.classList.toggle("active", row.getAttribute("data-protocol") === selectedProtocol);
	});

	// Update description
	const desc = el("protocol-desc");
	if (desc) desc.textContent = proto.desc;
}

// --- Relay API Integration ---------------------------------------------------

async function relayQuote(fromChain, toChain, amount, token) {
	const isTestnet = state.testnetMode;
	const apiBase = isTestnet ? PROTOCOLS.relay.testnetApiBase : PROTOCOLS.relay.apiBase;

	const originCurrency = token === "ETH"
		? "0x0000000000000000000000000000000000000000"
		: CONFIG.tokens[token].addresses[fromChain.key] || "0x0000000000000000000000000000000000000000";
	const destinationCurrency = token === "ETH"
		? "0x0000000000000000000000000000000000000000"
		: CONFIG.tokens[token].addresses[toChain.key] || "0x0000000000000000000000000000000000000000";

	try {
		const res = await fetch(`${apiBase}/quote/v2`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				user: state.account,
				originChainId: fromChain.chainId,
				destinationChainId: toChain.chainId,
				originCurrency,
				destinationCurrency,
				amount: amount.toString(),
				tradeType: "EXACT_INPUT",
			}),
			signal: AbortSignal.timeout(15000),
		});

		if (!res.ok) return null;
		const data = await res.json();
		if (data.message) return null;

		const output = data.details?.currencyOut?.amount;
		const fee = data.details?.totalImpact?.percent;
		const time = data.details?.timeEstimate;
		const steps = data.steps || [];

		return {
			protocol: "relay",
			output: output ? BigInt(output) : null,
			feePercent: fee || "0",
			estTimeSec: time || 3,
			steps,
			raw: data,
		};
	} catch {
		return null;
	}
}

async function relayExecute(quote) {
	if (!quote || !quote.steps || !quote.steps.length) throw new Error("No steps in quote");

	for (const step of quote.steps) {
		const item = step.items?.[0];
		if (!item || !item.data) continue;

		if (step.kind === "transaction") {
			const tx = await state.signer.sendTransaction({
				to: item.data.to,
				data: item.data.data,
				value: item.data.value ? BigInt(item.data.value) : 0n,
			});
			const receipt = await tx.wait();
			return { txHash: receipt.hash, requestId: step.requestId };
		}
	}
	throw new Error("No transaction step found");
}

// --- Li.Fi API Integration ---------------------------------------------------

async function lifiQuote(fromChain, toChain, amount, token) {
	const fromAddr = token === "ETH"
		? "0x0000000000000000000000000000000000000000"
		: CONFIG.tokens[token].addresses[fromChain.key];
	const toAddr = token === "ETH"
		? "0x0000000000000000000000000000000000000000"
		: CONFIG.tokens[token].addresses[toChain.key];

	if (!fromAddr || !toAddr) return null;

	try {
		const params = new URLSearchParams({
			fromChain: fromChain.chainId.toString(),
			toChain: toChain.chainId.toString(),
			fromToken: fromAddr,
			toToken: toAddr,
			fromAmount: amount.toString(),
			fromAddress: state.account || "0x0000000000000000000000000000000000000000",
		});

		const res = await fetch(`${PROTOCOLS.lifi.apiBase}/quote?${params}`, {
			signal: AbortSignal.timeout(15000),
		});

		if (!res.ok) return null;
		const data = await res.json();

		return {
			protocol: "lifi",
			output: data.toAmount ? BigInt(data.toAmount) : null,
			feePercent: "0.25",
			estTimeSec: data.estimatedRouteDuration || 30,
			tool: data.tool,
			transactionRequest: data.transactionRequest,
			raw: data,
		};
	} catch {
		return null;
	}
}

async function lifiExecute(quote) {
	if (!quote || !quote.transactionRequest) throw new Error("No transaction data in Li.Fi quote");

	const tx = await state.signer.sendTransaction({
		to: quote.transactionRequest.to,
		data: quote.transactionRequest.data,
		value: quote.transactionRequest.value ? BigInt(quote.transactionRequest.value) : 0n,
	});
	const receipt = await tx.wait();
	return { txHash: receipt.hash };
}

// --- Across Protocol Integration -----------------------------------------------

async function acrossQuote(fromChain, toChain, amount, token) {
	const inputAddr = token === "ETH"
		? "0x0000000000000000000000000000000000000000"
		: CONFIG.tokens[token]?.addresses?.[fromChain.key];
	const outputAddr = token === "ETH"
		? "0x0000000000000000000000000000000000000000"
		: CONFIG.tokens[token]?.addresses?.[toChain.key];

	if (!inputAddr || !outputAddr) return null;
	const apiKey = CONFIG.ethBridge?.apiKeys?.across || "";
	if (!apiKey) return null;

	try {
		const params = new URLSearchParams({
			originChainId: fromChain.chainId.toString(),
			destinationChainId: toChain.chainId.toString(),
			inputToken: inputAddr,
			outputToken: outputAddr,
			amount: amount.toString(),
			tradeType: "minOutput",
			depositor: state.account || "0x0000000000000000000000000000000000000000",
			integratorId: CONFIG.ethBridge?.apiKeys?.acrossIntegratorId || "0xdead",
		});

		const res = await fetch(`https://app.across.to/api/swap/approval?${params}`, {
			headers: { Authorization: `Bearer ${apiKey}` },
			signal: AbortSignal.timeout(15000),
		});
		if (!res.ok) return null;
		const data = await res.json();

		return {
			protocol: "across",
			output: data.expectedOutput ? BigInt(data.expectedOutput) : null,
			feePercent: "~0.05%",
			estTimeSec: 2,
			approvalTxns: data.approvalTxns || [],
			swapTx: data.swapTx,
			raw: data,
		};
	} catch { return null; }
}

async function acrossExecute(quote) {
	if (!quote || !quote.swapTx) throw new Error("No swap transaction in Across quote");
	for (const approvalTx of (quote.approvalTxns || [])) {
		const tx = await state.signer.sendTransaction({
			to: approvalTx.to, data: approvalTx.data,
			value: approvalTx.value ? BigInt(approvalTx.value) : 0n,
		});
		await tx.wait();
	}
	const tx = await state.signer.sendTransaction({
		to: quote.swapTx.to, data: quote.swapTx.data,
		value: quote.swapTx.value ? BigInt(quote.swapTx.value) : 0n,
	});
	const receipt = await tx.wait();
	return { txHash: receipt.hash };
}

// --- Stargate V2 Integration --------------------------------------------------

const STARGATE_ROUTER_ADDRESS = CONFIG.ethBridge?.stargateRouterAddress || "0x150f4E4bD86B9b3655702eFEfB78c8b1D9b5d6c0";
const STARGATE_ROUTER_MIN_ABI = [
	"function swapETH(uint16 _dstChainId, address payable _refundAddress, bytes calldata _toAddress, uint256 _amountLD, uint256 _minAmountLD, uint256 _dstGasForCall) external payable returns (uint256, uint256)",
	"function quoteSendFee(uint16 _dstChainId, uint256 _amount) external view returns (uint256 nativeFee, uint256 zroFee)"
];

async function stargateQuote(fromChain, toChain, amount, token) {
	if (token !== "ETH") return null;
	try {
		const provider = getReadProvider(fromChain.key);
		if (!provider) return null;
		const router = new ethers.Contract(STARGATE_ROUTER_ADDRESS, STARGATE_ROUTER_MIN_ABI, provider);
		const dstChainId = toChain.eid;
		if (!dstChainId) return null;
		const [nativeFee] = await router.quoteSendFee(dstChainId, amount);
		return {
			protocol: "stargateV2",
			output: amount - nativeFee,
			feePercent: "~0.06%",
			estTimeSec: 120,
			nativeFee,
			dstChainId,
		};
	} catch { return null; }
}

async function stargateExecute(quote, fromKey, toKey, parsedAmount) {
	if (!quote) throw new Error("No Stargate quote");
	const router = new ethers.Contract(STARGATE_ROUTER_ADDRESS, STARGATE_ROUTER_MIN_ABI, state.signer);
	const toAddress = ethers.zeroPadValue(state.account, 32);
	const minAmount = parsedAmount - (quote.nativeFee || 0n);
	const tx = await router.swapETH(
		quote.dstChainId, state.account, toAddress,
		parsedAmount, minAmount, 0n,
		{ value: parsedAmount }
	);
	const receipt = await tx.wait();
	return { txHash: receipt.hash };
}

// --- Socket/Bungee Integration ------------------------------------------------

async function socketQuote(fromChain, toChain, amount, token) {
	const inputAddr = token === "ETH"
		? "0x0000000000000000000000000000000000000000"
		: CONFIG.tokens[token]?.addresses?.[fromChain.key];
	const outputAddr = token === "ETH"
		? "0x0000000000000000000000000000000000000000"
		: CONFIG.tokens[token]?.addresses?.[toChain.key];
	if (!inputAddr || !outputAddr || !state.account) return null;
	try {
		const params = new URLSearchParams({
			originChainId: fromChain.chainId.toString(),
			destinationChainId: toChain.chainId.toString(),
			userAddress: state.account,
			receiverAddress: state.account,
			inputToken: inputAddr,
			outputToken: outputAddr,
			amount: amount.toString(),
			slippage: "0.999",
		});
		const res = await fetch(`https://public-backend.socket.tech/v3/swap/quote?${params}`, {
			signal: AbortSignal.timeout(15000),
		});
		if (!res.ok) return null;
		const data = await res.json();
		if (!data.success || !data.result?.routes?.length) return null;
		const route = data.result.routes[0];
		return {
			protocol: "socket",
			output: route.output?.amount ? BigInt(route.output.amount) : null,
			feePercent: "~0.2%",
			estTimeSec: route.estimatedTime || 60,
			route,
			raw: data.result,
		};
	} catch { return null; }
}

async function socketExecute(quote) {
	if (!quote || !quote.route) throw new Error("No Socket route data");
	const route = quote.route;
	if (route.userOp === "tx" && route.txData) {
		const tx = await state.signer.sendTransaction({
			to: route.txData.to, data: route.txData.data,
			value: route.txData.value ? BigInt(route.txData.value) : 0n,
		});
		const receipt = await tx.wait();
		return { txHash: receipt.hash };
	}
	throw new Error("No executable transaction data in Socket route");
}

// --- Protocol-aware quote fetching -------------------------------------------

async function fetchProtocolQuote(fromKey, toKey, amountWei, token) {
	const fromChain = CONFIG.chains[fromKey];
	const toChain = CONFIG.chains[toKey];
	if (!fromChain || !toChain) return null;

	const proto = getSelectedProtocol();
	const isArc = fromKey === "arc" || fromKey === "arcMainnet" || toKey === "arc" || toKey === "arcMainnet";

	// CCTP uses existing flow â€” no external quote needed (only for Arc routes)
	if (proto === "cctp" || (token === "USDC" && isArc)) {
		return { protocol: "cctp", output: null, feePercent: "~0.003%", estTimeSec: 900 };
	}

	// USDC on non-Arc EVMâ†”EVM routes: use external protocol quotes
	if (token === "USDC" && !isArc) {
		// Route to the selected protocol for USDC quote
		if (proto === "relay") return await relayQuote(fromChain, toChain, amountWei, token);
		if (proto === "lifi") return await lifiQuote(fromChain, toChain, amountWei, token);
		if (proto === "across") return await acrossQuote(fromChain, toChain, amountWei, token);
		// Fallback to LiFi for USDC
		return await lifiQuote(fromChain, toChain, amountWei, token);
	}

	if (proto === "relay") {
		return await relayQuote(fromChain, toChain, amountWei, token);
	}

	if (proto === "lifi") {
		return await lifiQuote(fromChain, toChain, amountWei, token);
	}

	if (proto === "across") {
		return await acrossQuote(fromChain, toChain, amountWei, token);
	}

	if (proto === "stargateV2") {
		return await stargateQuote(fromChain, toChain, amountWei, token);
	}

	if (proto === "socket") {
		return await socketQuote(fromChain, toChain, amountWei, token);
	}

	return null;
}

function updateQuoteDisplay(quote) {
	const outEl = el("est-output");
	const feeEl = el("est-fee");
	const timeEl = el("est-time");
	const routeEl = el("est-route");

	if (!quote) {
		if (outEl) outEl.textContent = "â€”";
		if (feeEl) feeEl.textContent = "â€”";
		if (timeEl) timeEl.textContent = "â€”";
		if (routeEl) routeEl.textContent = "â€”";
		return;
	}

	const token = getSelectedToken();
	const decimals = token === "USDC" ? 6 : 18;
	const symbol = token;

	if (outEl) {
		outEl.textContent = quote.output
			? truncateUnits(quote.output, decimals, 4) + " " + symbol
			: "â€”";
	}
	if (feeEl) feeEl.textContent = quote.feePercent || "—";
	if (timeEl) {
		const sec = quote.estTimeSec || 0;
		if (sec < 60) timeEl.textContent = `${sec}s`;
		else timeEl.textContent = `~${Math.round(sec / 60)}min`;
	}
	if (routeEl) routeEl.textContent = quote.tool || quote.protocol || "â€”";
}

// --- persistence (localStorage) ----------------------------------------------

function saveTxHistory() {
	try {
		localStorage.setItem(HISTORY_KEY, JSON.stringify(state.txHistory.slice(-50)));
	} catch { /* storage full/blocked â€” history stays in-memory only */ }
}

function loadTxHistory() {
	try {
		const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
		if (Array.isArray(raw)) {
			state.txHistory = raw.filter(e =>
				e && typeof e.id === "string" && typeof e.label === "string" &&
				["pending", "success", "failed"].includes(e.status) &&
				(typeof e.hash === "string" || e.hash == null)
			);
		}
	} catch { /* corrupt payload â€” start fresh */ }
}

// One interrupted CCTP transfer may be resumed after a reload: the burn already
// succeeded on-chain, so the mint (or the forward-completion poll) can be
// redone from the saved burn hash alone.
function savePendingCctp(p) {
	try { localStorage.setItem(PENDING_KEY, JSON.stringify(p)); } catch { }
}

function loadPendingCctp() {
	try {
		const p = JSON.parse(localStorage.getItem(PENDING_KEY) || "null");
		// recipient is optional but must be a string when present â€” a non-string
		// from a hand-corrupted payload would throw inside shortAddr/showPendingBanner
		// and abort the rest of page init.
		if (p && p.burnHash && p.fromKey && p.toKey && CONFIG.chains[p.fromKey] && CONFIG.chains[p.toKey] &&
			(p.recipient == null || typeof p.recipient === "string")) {
			return p;
		}
	} catch { }
	return null;
}

function clearPendingCctp() {
	try { localStorage.removeItem(PENDING_KEY); } catch { }
	const banner = el("pending-resume");
	if (banner) banner.style.display = "none";
}

function showPendingBanner() {
	const banner = el("pending-resume");
	const p = loadPendingCctp();
	if (!banner || !p) return;
	banner.style.display = "block";
	const text = banner.querySelector(".pending-text");
	if (text) {
		text.textContent = `Unfinished bridge: ${p.amount} USDC burned on ${CONFIG.chains[p.fromKey].shortName} â†’ ${CONFIG.chains[p.toKey].shortName}` +
			(p.forward ? " (waiting for Circle forward)" : " (mint not yet submitted)") +
			(p.recipient ? ` Â· penerima ${shortAddr(p.recipient)}` : "");
	}
}

function addTxEntry(txId, label, status, chainKey) {
	state.txHistory.push({ id: txId, label, status, hash: "", chainKey });
	saveTxHistory();
	renderTxHistory();
}

function updateTxEntry(txId, status, hash) {
	const entry = state.txHistory.find(e => e.id === txId);
	if (!entry) return;
	entry.status = status;
	entry.hash = hash;
	saveTxHistory();
	renderTxHistory();
}

function renderTxHistory() {
	const list = el("tx-list");
	if (!list) return;
	list.innerHTML = "";
	if (state.txHistory.length === 0) {
		const empty = document.createElement("div");
		empty.className = "empty-state";
		empty.textContent = "No transactions yet";
		list.appendChild(empty);
		return;
	}
	state.txHistory.slice().reverse().forEach(entry => {
		const item = document.createElement("div");
		item.className = "tx-item";

		const status = document.createElement("span");
		status.className = "tx-status " + entry.status;
		item.appendChild(status);

		const detail = document.createElement("div");
		detail.className = "tx-detail";

		const action = document.createElement("div");
		action.className = "tx-action";
		action.textContent = entry.label;
		detail.appendChild(action);

		if (entry.hash) {
			const chain = CONFIG.chains[entry.chainKey];
			if (chain && chain.explorer && chain.explorer.startsWith("https://")) {
				const link = document.createElement("a");
				link.className = "tx-hash";
				link.href = chain.explorer + "/tx/" + entry.hash;
				link.target = "_blank";
				link.rel = "noopener";
				link.textContent = entry.hash.slice(0, 6) + "..." + entry.hash.slice(-4);
				detail.appendChild(link);
			}
		}
		item.appendChild(detail);

		const badge = document.createElement("span");
		badge.className = "tx-badge " + entry.status;
		badge.textContent = entry.status;
		item.appendChild(badge);

		list.appendChild(item);
	});
}

function getChainKey(chainId) {
	return Object.keys(CONFIG.chains).find(k => CONFIG.chains[k].chainId === chainId) || null;
}

async function switchChain(chainId) {
	const p = state.wallet && state.wallet.eip1193;
	if (!p) return;
	try {
		await p.request({
			method: "wallet_switchEthereumChain",
			params: [{ chainId: "0x" + chainId.toString(16) }]
		});
	} catch (e) {
		// Some wallets wrap chain-not-added as -32603 with data.originalError.code 4902
		const code = e.code ?? e.data?.originalError?.code;
		if (code === 4902) {
			const chain = Object.values(CONFIG.chains).find(c => c.chainId === chainId);
			if (!chain) return;
			await p.request({
				method: "wallet_addEthereumChain",
				params: [{
					chainId: "0x" + chainId.toString(16),
					chainName: chain.name,
					rpcUrls: [chain.rpcUrl],
					nativeCurrency: chain.nativeCurrency,
					blockExplorerUrls: [chain.explorer]
				}]
			});
		} else throw e;
	}
}

// Re-create provider/signer after a wallet chain switch â€” ethers caches the
// network on the BrowserProvider instance, so a stale signer would send the
// mint transaction to the wrong chain.
async function refreshProvider() {
	if (!state.wallet) return;
	state.provider = new ethers.BrowserProvider(state.wallet.eip1193);
	state.signer = await state.provider.getSigner();
	state.chainId = Number(await state.wallet.eip1193.request({ method: "eth_chainId" }));
}
// Navbar network picker. Rebuilt from scratch on every call so it always
// mirrors getFilteredChains() (same mode filter/sort as the bridge selects);
// hidden while disconnected. A wallet sitting on a chain outside the active
// mode's list gets a disabled "Unknown network" placeholder instead.
function renderWalletChainPicker() {
	const sel = el("wallet-chain");
	if (!sel) return;
	if (!state.wallet) { sel.hidden = true; return; }
	sel.hidden = false;
	const keys = getFilteredChains();
	sel.innerHTML = "";
	const knownKey = keys.find(k => CONFIG.chains[k].chainId === state.chainId);
	if (!knownKey) {
		const opt = document.createElement("option");
		opt.disabled = true;
		opt.value = "unknown";
		opt.textContent = `Unknown network (${state.chainId ?? "?"})`;
		sel.appendChild(opt);
	}
	keys.forEach(k => {
		const c = CONFIG.chains[k];
		const opt = document.createElement("option");
		opt.value = String(c.chainId);
		opt.textContent = c.shortName;
		opt.title = c.name;
		sel.appendChild(opt);
	});
	sel.value = knownKey ? String(state.chainId) : "unknown";
}

// User picked a network in the navbar select. A successful switchChain also
// fires the provider's chainChanged event (_chainChanged re-runs
// refreshProvider/onAccountChange) â€” the double refresh is safe because
// bindWalletEvents never accumulates listeners on an already-bound provider.
async function onWalletChainChange() {
	const sel = el("wallet-chain");
	if (!state.wallet || sel.disabled) { renderWalletChainPicker(); return; }
	const id = Number(sel.value);
	if (!id) return;
	sel.disabled = true;
	try {
		await switchChain(id);
		await refreshProvider();
		toast(`Switched to ${CONFIG.chains[getChainKey(id)]?.shortName || ("chain " + id)}`, "success");
	} catch (e) {
		toast("Switch failed: " + (e.message || e.code), "error");
	} finally {
		sel.disabled = false;
		renderWalletChainPicker();
		onAccountChange();
	}
}

// Thin backward-safe entry (the bridge flow still calls it when no signer):
// route to the legacy injected wallet registered by wallets.js' fallback,
// else the first EIP-6963-discovered one.
async function connectWallet() {
	if (state.isConnecting) return;
	const entries = window.WalletRegistry ? window.WalletRegistry.discovered : [];
	const entry = entries.find(e => e.info.rdns === LEGACY_WALLET_RDNS) || entries[0];
	if (!entry) {
		toast(t("noWallet"), "error");
		return;
	}
	return connectWith(entry.provider, entry.info.name, "injected");
}

function updateConnectBtn(text) {
	const btn = el("connect-btn");
	if (btn) btn.textContent = text;
}

async function disconnectWallet() {
	const previous = state.wallet;
	// Synchronous UI/state resets happen BEFORE any await below.
	state.provider = null;
	state.signer = null;
	state.account = null;
	state.chainId = null;
	state.isConnecting = false;
	state.wallet = null;
	if (state._boundProvider) {
		if (state._accountsChanged) state._boundProvider.removeListener("accountsChanged", state._accountsChanged);
		if (state._chainChanged) state._boundProvider.removeListener("chainChanged", state._chainChanged);
	}
	state._boundProvider = null;
	state._accountsChanged = null;
	state._chainChanged = null;
	state._eventsBound = false;
	try { localStorage.removeItem(WALLET_PREF_KEY); } catch { }
	onAccountChange();
	// WalletConnect sessions outlive the page â€” terminate the server-side
	// pairing too, after the local reset (never blocking the UI on it).
	if (previous && previous.type === "walletconnect" &&
		previous.eip1193 && typeof previous.eip1193.disconnect === "function") {
		try { await previous.eip1193.disconnect(); } catch { }
	}
	renderWalletChainPicker();
}

function onAccountChange() {
	const btn = el("connect-btn");
	const badge = el("network-badge");
	const card = document.querySelector(".bridge-card");

	if (state.account) {
		const short = state.account.slice(0, 6) + "..." + state.account.slice(-4);
		btn.textContent = short;
		btn.className = "btn btn-sm";

		const chain = getChainConfig(state.chainId);
		if (chain) {
			badge.innerHTML = `<span class="dot"></span> ${chain.shortName}`;
			badge.style.display = "flex";
		} else {
			badge.innerHTML = `<span style="background:var(--red);width:6px;height:6px;border-radius:50%;display:inline-block"></span> Unsupported`;
			badge.style.display = "flex";
		}

		if (card) card.classList.remove("disconnected");
		loadBalances();
		updateContractInfo();
	} else {
		btn.textContent = t("connectWallet");
		btn.className = "btn btn-primary btn-sm";
		badge.style.display = "none";
		const bridgeArea = el("bridge-area");
		if (bridgeArea) bridgeArea.style.display = "none";
	}
}

function getChainConfig(chainId) {
	return Object.values(CONFIG.chains).find(c => c.chainId === chainId);
}

function getFromChain() {
	const v = el("from-chain").value;
	return CONFIG.chains[v];
}

function getToChain() {
	const v = el("to-chain").value;
	return CONFIG.chains[v];
}

function getSelectedToken() {
	return el("token-select").value;
}

function isForwardEnabled() {
	const t = el("forward-toggle");
	return !!(t && t.checked);
}

// Read-only provider for the SELECTED source chain. Balances and gas estimates
// must reflect what the user picked in the UI â€” not whatever chain the wallet
// happens to be connected to. Falls back to the chain's public RPC (all hosts
// are allow-listed in the CSP) when the wallet sits elsewhere.
const readProviders = {};
function getReadProvider(chainKey) {
	const chain = CONFIG.chains[chainKey];
	if (!chain) return null;
	if (state.provider && state.chainId === chain.chainId) return state.provider;
	if (!readProviders[chainKey]) {
		readProviders[chainKey] = new ethers.JsonRpcProvider(chain.rpcUrl);
	}
	return readProviders[chainKey];
}

// Overlapping balance reads (fast token/chain flips) can resolve out of
// order â€” only the latest invocation may write the balance display.
let balSeq = 0;

async function loadBalances() {
	if (!state.account) return;

	const token = getSelectedToken();
	const fromKey = el("from-chain").value;
	const provider = getReadProvider(fromKey);
	if (!fromKey || !provider) { state.lastFromBalanceRaw = null; el("from-balance").textContent = "0.00"; return; }

	const seq = ++balSeq;
	const isStale = () => seq !== balSeq;
	try {
		if (token === "USDC") {
			// Always the 6-dec ERC-20 view (on Arc it is the same asset as native
			// gas â€” one balance, two views; never sum or convert between them).
			const addr = CONFIG.tokens.USDC.addresses[fromKey];
			if (addr && addr !== "0x0000000000000000000000000000000000000000") {
				const contract = new ethers.Contract(addr, ERC20_ABI, provider);
				const bal = await contract.balanceOf(state.account);
				if (isStale()) return;
				state.lastFromBalanceRaw = bal;
				el("from-balance").textContent = truncateUnits(bal, 6, 2);
			} else {
				state.lastFromBalanceRaw = null;
				el("from-balance").textContent = "N/A";
			}
		} else if (token === "ETH") {
			// Native ETH balance (18 decimals) â€” not available on Arc (USDC is gas)
			const chain = CONFIG.chains[fromKey];
			if (chain && chain.nativeCurrency && chain.nativeCurrency.symbol === "ETH") {
				const bal = await provider.getBalance(state.account);
				if (isStale()) return;
				state.lastFromBalanceRaw = bal;
				el("from-balance").textContent = truncateUnits(bal, 18, 6);
			} else {
				state.lastFromBalanceRaw = null;
				el("from-balance").textContent = "N/A";
			}
		} else {
			state.lastFromBalanceRaw = null;
			el("from-balance").textContent = "0.00";
		}
	} catch {
		if (isStale()) return;
		state.lastFromBalanceRaw = null;
		el("from-balance").textContent = "0.00";
	}
}

// Truncates (never rounds up) to `places` fractional digits via string
// manipulation â€” Number() would lose precision on huge balances and toFixed()
// rounds half-up, which let MAX submit more than the actual balance.
function truncateUnits(value, decimals, places) {
	try {
		let s = ethers.formatUnits(value, decimals);
		if (!s.includes(".")) s += ".";
		const [int, frac = ""] = s.split(".");
		const padded = frac.padEnd(places, "0").slice(0, places);
		return (int + "." + padded).replace(/\.?0+$/, "").replace(/\.$/, "");
	} catch {
		return "0";
	}
}

function updateContractInfo() {
	const fromKey = el("from-chain").value;
	const toKey = el("to-chain").value;
	const c1 = el("from-contracts");
	const c2 = el("to-contracts");

	c1.innerHTML = "";
	c2.innerHTML = "";
	c1.appendChild(renderContractList(fromKey));
	c2.appendChild(renderContractList(toKey));

	const fromChain = CONFIG.chains[fromKey];
	const toChain = CONFIG.chains[toKey];
	el("from-chain-name").textContent = fromChain.shortName;
	el("to-chain-name").textContent = toChain.shortName;
	el("from-domain").textContent = fromChain.cctpDomain != null ? fromChain.cctpDomain : "â€”";
	el("to-domain").textContent = toChain.cctpDomain != null ? toChain.cctpDomain : "â€”";
	el("from-cid").textContent = fromChain.chainId;
	el("to-cid").textContent = toChain.chainId;
}

function renderContractList(chainKey) {
	const chain = CONFIG.chains[chainKey] || {};
	const c = chain.cctp || {};
	const entries = [];
	const usdcAddr = c.usdc || (CONFIG.tokens.USDC.addresses || {})[chainKey];
	if (usdcAddr) entries.push(["USDC", usdcAddr]);
	if (c.tokenMessengerV2) entries.push(["TokenMessenger V2", c.tokenMessengerV2]);
	if (c.messageTransmitterV2) entries.push(["MessageTransmitter V2", c.messageTransmitterV2]);
	if (c.tokenMinterV2) entries.push(["TokenMinter V2", c.tokenMinterV2]);

	const container = document.createElement("div");
	container.className = "contract-list";
	if (entries.length === 0) {
		const none = document.createElement("div");
		none.className = "contract-item";
		none.textContent = "No contracts";
		container.appendChild(none);
		return container;
	}
	entries.forEach(([label, addr]) => {
		const item = document.createElement("div");
		item.className = "contract-item";

		const labelSpan = document.createElement("span");
		labelSpan.className = "contract-label";
		labelSpan.textContent = label;
		item.appendChild(labelSpan);

		const addrSpan = document.createElement("span");
		addrSpan.className = "contract-addr";
		addrSpan.textContent = addr || "not deployed";
		addrSpan.title = addr || "not deployed";
		if (addr) addrSpan.addEventListener("click", () => copyAddr(addr));
		item.appendChild(addrSpan);

		container.appendChild(item);
	});
	return container;
}

async function copyAddr(addr) {
	try {
		await navigator.clipboard.writeText(addr);
		toast("Address copied", "success");
	} catch { }
}

// ---------------------------------------------------------------------------
// Fee estimation
// ---------------------------------------------------------------------------

// Burn fee quote from Circle Iris (units of the burn token, 6 dec).
// GET /v2/burn/USDC/fees/{src}/{dst}[?forward=true] (verified live 2026-08-22):
//   [{"finalityThreshold":1000,"minimumFee":1},
//    {"finalityThreshold":1000,"minimumFee":1,"forwardFee":{"low":18076,"med":18497,"high":19625}}]
// Manual mode: maxFee = 10Ã— the fast minimum (floor 500 = official quickstart
// value) so the burn doesn't revert if the fee ticks up before landing â€”
// feeExecuted at destination is capped by maxFee.
// Forwarding mode REQUIRES a live quote: its fee is orders of magnitude above
// the manual minimum, so no hardcoded fallback is ever used (returns null).
async function quoteBurnFee(fromChain, toChain, forward, amountSubunits = 0n) {
	try {
		const url = `${CONFIG.iris[fromChain.network]}/v2/burn/USDC/fees/${fromChain.cctpDomain}/${toChain.cctpDomain}${forward ? "?forward=true" : ""}`;
		const res = await fetch(url);
		if (res.ok) {
			const data = await res.json();
			const q = extractFastQuote(data);
			if (q) {
				// Protocol component scales with the burn amount â€” canonical quickstart
				// Step 4 math: protocolFee = amount Ã— minimumFee Ã— 100 / 1e6
				// (developers.circle.com/cctp/quickstarts/transfer-usdc-ethereum-to-arc).
				const protocolFee = (amountSubunits * BigInt(Math.round(Number(q.minimumFee) * 100))) / 1_000_000n;
				if (forward) {
					if (!q.forwardFee) return null; // forwarding not quoted for this route
					// maxFee cap = forwarding fee (quoted med) + protocol component,
					// mirroring the quickstart's maxFee = forwardFee + protocolFee.
					const maxFee = BigInt(q.forwardFee.med) + protocolFee;
					return { maxFee, forwardFee: q.forwardFee.med, minimumFee: q.minimumFee };
				}
				const buffered = q.minimumFee * 10n;
				const maxFee = buffered > protocolFee + 500n ? buffered : protocolFee + 500n;
				return { maxFee, forwardFee: null, minimumFee: q.minimumFee };
			}
		}
	} catch { /* fall through */ }
	if (forward) return null; // never guess a forwarding fee
	return { maxFee: BigInt(CONFIG.cctpDefaults.fallbackMaxFee), forwardFee: null, minimumFee: BigInt(CONFIG.cctpDefaults.fallbackMaxFee) };
}

function extractFastQuote(data) {
	// Fast transfer = finalityThreshold 1000 (2000+ is standard/finalized)
	const list = Array.isArray(data) ? data : [data];
	const fast = list.find(e => e && Number(e.finalityThreshold) === 1000);
	if (!fast || fast.minimumFee == null) return null;
	try {
		// minimumFee can be float (e.g. 1.3) â€” round to integer for BigInt
		const minimumFee = BigInt(Math.round(Number(fast.minimumFee)));
		let forwardFee = null;
		if (fast.forwardFee && fast.forwardFee.high != null) {
			forwardFee = {
				low: BigInt(Math.round(Number(fast.forwardFee.low))),
				med: BigInt(Math.round(Number(fast.forwardFee.med))),
				high: BigInt(Math.round(Number(fast.forwardFee.high)))
			};
		}
		return { minimumFee, forwardFee };
	} catch {
		return null;
	}
}

// Overlapping estimates (fast typing, chain flips) can resolve out of order â€”
// only the latest invocation may write to the fee display.
let estSeq = 0;

async function estimateGas() {
	const fromKey = el("from-chain").value;
	const toKey = el("to-chain").value;
	const fromChain = CONFIG.chains[fromKey];
	const toChain = CONFIG.chains[toKey];
	if (!fromChain || !toChain || fromKey === toKey) return;

	const seq = ++estSeq;
	const isStale = () => seq !== estSeq;
	const elEst = el("gas-fee");
	const elFeeUsdc = el("gas-fee-usdc");
	elEst.textContent = "Estimating...";
	if (elFeeUsdc) elFeeUsdc.textContent = "Estimating...";

	try {
		const token = getSelectedToken();

		if (token === "USDC") {
			// Source-side gas for depositForBurn (native gas units of the source chain)
			const usdcAddr = CONFIG.tokens.USDC.addresses[fromKey];
			if (!usdcAddr || !fromChain.cctp) { elEst.textContent = "N/A"; if (elFeeUsdc) elFeeUsdc.textContent = "N/A"; return; }

			const forward = isForwardEnabled();
			const quote = await quoteBurnFee(fromChain, toChain, forward, 1_000_000n);
			if (isStale()) return;
			if (elFeeUsdc) {
				if (!quote) {
					elFeeUsdc.textContent = "quote unavailable";
				} else if (forward) {
					elFeeUsdc.textContent = "~" + truncateUnits(quote.minimumFee + quote.forwardFee, 6, 4) + " USDC (forward)";
				} else {
					elFeeUsdc.textContent = "~" + truncateUnits(quote.minimumFee, 6, 4) + " USDC (fast)";
				}
			}

			const provider = getReadProvider(fromKey);
			if (provider) {
				const messenger = new ethers.Contract(fromChain.cctp.tokenMessengerV2, TOKEN_MESSENGER_V2_ABI, provider);
				const maxFee = quote ? quote.maxFee : BigInt(CONFIG.cctpDefaults.fallbackMaxFee);
				const mintRecipient = ethers.zeroPadValue(state.account || ethers.ZeroAddress, 32);
				const populated = forward
					? await messenger.depositForBurnWithHook.populateTransaction(
						ethers.parseUnits("1", 6), toChain.cctpDomain, mintRecipient,
						usdcAddr, ethers.ZeroHash, maxFee, CONFIG.cctpDefaults.minFinalityThreshold,
						CONFIG.cctpDefaults.forwardHook
					)
					: await messenger.depositForBurn.populateTransaction(
						ethers.parseUnits("1", 6), toChain.cctpDomain, mintRecipient,
						usdcAddr, ethers.ZeroHash, maxFee, CONFIG.cctpDefaults.minFinalityThreshold
					);
				const [gas, feeData] = await Promise.all([
					provider.estimateGas({ ...populated, from: state.account }),
					provider.getFeeData()
				]);
				if (isStale()) return;
				const price = feeData.maxFeePerGas || feeData.gasPrice || 0n;
				const cost = gas * price;
				const decimals = fromChain.nativeCurrency.decimals;
				elEst.textContent = truncateUnits(cost, decimals, 6) + " " + fromChain.nativeCurrency.symbol;
			} else {
				elEst.textContent = "N/A";
			}
			return;
		}

		// ETH â€” fetch protocol quote for accurate estimate
		if (token === "ETH") {
			const proto = getSelectedProtocol();
			const amountWei = el("amount").value.trim()
				? ethers.parseUnits(el("amount").value.trim(), 18)
				: ethers.parseUnits("1", 18); // Default to1 ETH for estimate

			// Fetch protocol quote
			const quote = await fetchProtocolQuote(fromKey, toKey, amountWei, "ETH");
			if (isStale()) return;

			if (quote && quote.output) {
				updateQuoteDisplay(quote);
				// Show gas estimate from provider
				const provider = getReadProvider(fromKey);
				if (provider) {
					const feeData = await provider.getFeeData();
					if (isStale()) return;
					const price = feeData.maxFeePerGas || feeData.gasPrice || 0n;
					const cost = 21000n * price;
					const decimals = fromChain.nativeCurrency.decimals;
					elEst.textContent = truncateUnits(cost, decimals, 6) + " " + fromChain.nativeCurrency.symbol;
				}
			} else {
				// Fallback to simple gas estimate
				const provider = getReadProvider(fromKey);
				if (provider) {
					const feeData = await provider.getFeeData();
					if (isStale()) return;
					const price = feeData.maxFeePerGas || feeData.gasPrice || 0n;
					const cost = 21000n * price;
					const decimals = fromChain.nativeCurrency.decimals;
					elEst.textContent = truncateUnits(cost, decimals, 6) + " " + fromChain.nativeCurrency.symbol;
				} else {
					elEst.textContent = "N/A";
				}
				if (elFeeUsdc) elFeeUsdc.textContent = "N/A";
			}
			return;
		}
	} catch (e) {
		if (!isStale()) elEst.textContent = "N/A";
	}
}

// ---------------------------------------------------------------------------
// Bridging â€” USDC via CCTP V2, ETH via external protocols
// ---------------------------------------------------------------------------

async function bridge() {
	if (state.isBridging) return;
	state.isBridging = true;

	try {
		if (!state.signer || !state.account) {
			await connectWallet();
			return;
		}

		const fromKey = el("from-chain").value;
		const toKey = el("to-chain").value;
		const amount = el("amount").value.trim();
		const token = getSelectedToken();
		const tokenDecimals = token === "USDC" ? 6 : 18;

		if (!amount) { toast("Enter a valid amount", "error"); return; }

		let parsedAmount;
		try {
			parsedAmount = ethers.parseUnits(amount, tokenDecimals);
		} catch {
			toast("Invalid amount format", "error");
			return;
		}
		if (parsedAmount === 0n) { toast("Amount must be greater than 0", "error"); return; }
		// lastFromBalanceRaw tracks the SELECTED source chain â€” reject before the
		// approve can succeed and strand the user at a reverting burn.
		if (state.lastFromBalanceRaw != null && parsedAmount > state.lastFromBalanceRaw) {
			toast("Amount exceeds your " + token + " balance on " + CONFIG.chains[fromKey].shortName, "error");
			return;
		}

		const proto = getSelectedProtocol();
		const isArcRoute = fromKey === "arc" || fromKey === "arcMainnet" || toKey === "arc" || toKey === "arcMainnet";

		// Routing logic:
		// - USDC + ARC route â†’ CCTP (Circle's native bridge for Arc)
		// - USDC + non-ARC route â†’ Relay/Li.Fi (external protocols)
		// - ETH â†’ always Relay/Li.Fi (CCTP doesn't support ETH)
		if (token === "USDC" && isArcRoute) {
			await bridgeUSDCViaCCTP(amount, parsedAmount, fromKey, toKey);
		} else if (token === "USDC" && !isArcRoute) {
			// USDC between non-ARC chains â†’ use external protocol
			if (proto === "relay") await bridgeViaRelay(amount, parsedAmount, fromKey, toKey);
			else if (proto === "lifi") await bridgeViaLiFi(amount, parsedAmount, fromKey, toKey);
			else if (proto === "across") await bridgeViaAcross(amount, parsedAmount, fromKey, toKey);
			else if (proto === "stargateV2") await bridgeViaStargate(amount, parsedAmount, fromKey, toKey);
			else if (proto === "socket") await bridgeViabungee(amount, parsedAmount, fromKey, toKey);
			else await bridgeViaRelay(amount, parsedAmount, fromKey, toKey); // default fallback
		} else if (token === "ETH") {
			// ETH â†’ always use external protocol (CCTP doesn't support ETH)
			if (proto === "relay") await bridgeViaRelay(amount, parsedAmount, fromKey, toKey);
			else if (proto === "lifi") await bridgeViaLiFi(amount, parsedAmount, fromKey, toKey);
			else if (proto === "across") await bridgeViaAcross(amount, parsedAmount, fromKey, toKey);
			else if (proto === "stargateV2") await bridgeViaStargate(amount, parsedAmount, fromKey, toKey);
			else if (proto === "socket") await bridgeViabungee(amount, parsedAmount, fromKey, toKey);
			else await bridgeETHNative(amount, parsedAmount, fromKey, toKey); // fallback
		}
	} finally {
		state.isBridging = false;
		setFlowsBusy(false);
		updateBridgeBtn();
	}
}

// Circle CCTP V2 burn-and-mint. forward=true routes through Circle's
// Forwarding Service (depositForBurnWithHook + "cctp-forward" hook) so the
// destination mint is submitted by Circle â€” essential when the recipient has
// no gas on the destination (USDC is gas on Arc).
// Reference quickstart: https://developers.circle.com/cctp/quickstarts/transfer-usdc-ethereum-to-arc
async function bridgeUSDCViaCCTP(amount, parsedAmount, fromKey, toKey) {
// USDC bridge between two non-Arc EVM chains â€” uses backend-configured protocols
// (LiFi â†’ Relay â†’ Across â†’ Stargate â†’ Socket) since CCTP is only for Arc routes.
async function bridgeUSDCViaProtocols(amount, parsedAmount, fromKey, toKey) {
	const fromChain = CONFIG.chains[fromKey];
	const toChain = CONFIG.chains[toKey];

	if (fromChain.network !== toChain.network) {
		toast(t("networkMismatch"), "error");
		return;
	}

	const protocols = [
		{ name: "Li.Fi",      fn: bridgeViaLiFi },
		{ name: "Relay",      fn: bridgeViaRelay },
		{ name: "Across",     fn: bridgeViaAcross },
	];
	const apiKeyAcross = CONFIG.ethBridge?.apiKeys?.across || "";
	const filtered = protocols.filter(p => {
		if (p.name === "Across" && !apiKeyAcross) return false;
		return true;
	});

	for (const proto of filtered) {
		try {
			await proto.fn(amount, parsedAmount, fromKey, toKey);
			return; // success
		} catch (e) {
			console.warn(`[USDC Bridge] ${proto.name} failed: ${e.message}. Next...`);
		}
	}
	// All failed â€” the last bridgeViaXxx already showed its error toast
}
	const fromChain = CONFIG.chains[fromKey];
	const toChain = CONFIG.chains[toKey];
	const usdcAddr = CONFIG.tokens.USDC.addresses[fromKey];
	const forward = isForwardEnabled();

	if (!usdcAddr || !fromChain.cctp || !toChain.cctp) {
		toast("CCTP not available on this route", "error");
		return;
	}
	if (fromChain.network !== toChain.network) {
		toast("Source and destination must be on the same network (testnet/mainnet)", "error");
		return;
	}

	const arcOverrides = (key) => key === "arc"
		// Arc: type-2 tx, maxFeePerGas â‰¥ 20 Gwei floor, priority tip 0 is accepted
		? { maxFeePerGas: ethers.parseUnits("30", "gwei"), maxPriorityFeePerGas: 0n }
		: {};

	const quote = await quoteBurnFee(fromChain, toChain, forward, parsedAmount);
	if (!quote) {
		toast("Forwarding fee quote unavailable â€” turn off Forwarding Service or retry", "error");
		return;
	}
	// The executed fee is deducted from the transferred amount â€” an amount at or
	// below the fee would burn everything (or revert).
	const feeTotal = quote.minimumFee + (quote.forwardFee || 0n);
	if (parsedAmount <= feeTotal) {
		toast("Amount must exceed the CCTP fee (" + truncateUnits(feeTotal, 6, 4) + " USDC)", "error");
		return;
	}

	const burnTxId = "burn-" + Date.now();
	const btn = el("bridge-btn");
	setFlowsBusy(true);
	let subTxId = null; // fwd-/att- sub-entry â€” must not stay "pending" on abort

	// Initialize CCTP step tracker
	resetStepper();
	showStepper();
	updateStepper("burn", "active");

	try {
		// 1. Make sure the wallet is on the source chain (and signer is fresh)
		if (state.chainId !== fromChain.chainId) {
			toast(`Switching wallet to ${fromChain.name}...`, "info");
			await switchChain(fromChain.chainId);
			await refreshProvider();
		}
		const expectedAccount = state.account;
		// A wallet account/chain switch mid-flow would send from the wrong key
		// or chain â€” abort before any transaction is submitted.
		const assertWalletStable = () => {
			if (state.account !== expectedAccount || state.chainId !== fromChain.chainId) {
				throw new Error("Wallet account or chain changed mid-flow â€” aborting before send (no transaction was submitted)");
			}
		};

		// 2. Approve TokenMessengerV2 to burn USDC
		const messengerAddr = fromChain.cctp.tokenMessengerV2;
		const usdc = new ethers.Contract(usdcAddr, ERC20_ABI, state.signer);
		const allowance = await usdc.allowance(state.account, messengerAddr);
		if (allowance < parsedAmount + quote.maxFee) {
			assertWalletStable();
			btn.textContent = "Approving USDC...";
			toast("Approving USDC for TokenMessengerV2...", "info");
			const approveTx = await usdc.approve(messengerAddr, parsedAmount + quote.maxFee, arcOverrides(fromKey));
			await approveTx.wait();
			toast("USDC approved", "success");
		}

		// 3. Burn on the source chain
		assertWalletStable();
		btn.textContent = `Burning ${amount} USDC...`;
		addTxEntry(burnTxId, `Burn ${amount} USDC on ${fromChain.shortName}`, "pending", fromKey);
		const messenger = new ethers.Contract(messengerAddr, TOKEN_MESSENGER_V2_ABI, state.signer);
		const mintRecipient = ethers.zeroPadValue(state.account, 32);
		// destinationCaller = zero bytes32 â†’ any address may submit receiveMessage.
		// Forward path burns totalAmount = amount + maxFee (quickstart Step 3.2/3.3)
		// so the recipient receives the nominal amount after Circle's fee deduction;
		// the direct-mint path burns the plain amount exactly like the quickstart.
		const burnAmount = forward ? parsedAmount + quote.maxFee : parsedAmount;
		const burnArgs = [
			burnAmount,
			toChain.cctpDomain,
			mintRecipient,
			usdcAddr,
			ethers.ZeroHash,
			quote.maxFee,
			CONFIG.cctpDefaults.minFinalityThreshold
		];
		const burnTx = forward
			? await messenger.depositForBurnWithHook(...burnArgs, CONFIG.cctpDefaults.forwardHook, arcOverrides(fromKey))
			: await messenger.depositForBurn(...burnArgs, arcOverrides(fromKey));
		updateTxEntry(burnTxId, "pending", burnTx.hash);
		const burnReceipt = await burnTx.wait();
		if (burnReceipt.status !== 1) throw new Error("Burn transaction failed");
		updateTxEntry(burnTxId, "success", burnTx.hash);

		// Stepper: burn done â†’ attestation/forward active
		updateStepper("burn", "done");
		updateStepperLine("burn", "done");
		updateStepper("attest", "active");

		// Persist enough to resume if the flow dies before the mint lands
		savePendingCctp({
			burnHash: burnTx.hash,
			fromKey, toKey, amount,
			forward,
			recipient: state.account,
			createdAt: Date.now()
		});
		showPendingBanner();

		if (forward) {
			// 4a. Circle's relayer submits the mint; we only wait for its tx hash
			btn.textContent = "Waiting for Circle forward...";
			const fwdTxId = "fwd-" + Date.now();
			subTxId = fwdTxId;
			addTxEntry(fwdTxId, `Forward mint on ${toChain.shortName} (Circle)`, "pending", toKey);
			let forwardHash;
			try {
				forwardHash = await pollForwardCompletion(CONFIG.iris[fromChain.network], fromChain.cctpDomain, burnTx.hash);
			} catch (e) {
				if (e.name !== "ForwardTimeoutWithAttestation") throw e;
				// Forwarder stalled but the attestation is signed â€” mint manually
				// (fwd- is done; the fallback mint gets its own entry).
				updateTxEntry(fwdTxId, "failed", "");
				await manualMintFallback(toChain, toKey, e.att, amount);
				return;
			}
			updateTxEntry(fwdTxId, "success", forwardHash);
			toast(`Bridge complete! ${amount} USDC â†’ ${toChain.shortName} (forwarded by Circle)`, "success");
			clearPendingCctp();
			loadBalances();
			// Stepper: all done
			updateStepper("attest", "done");
			updateStepperLine("attest", "done");
			updateStepper("mint", "done");
		} else {
			// 4b. Wait for Circle to sign the attestation (fast â‰ˆ seconds)
			btn.textContent = "Waiting for attestation...";
			const attTxId = "att-" + Date.now();
			subTxId = attTxId;
			addTxEntry(attTxId, "Circle attestation (fast)", "pending", fromKey);
			const att = await pollAttestation(CONFIG.iris[fromChain.network], fromChain.cctpDomain, burnTx.hash);
			updateTxEntry(attTxId, "success", burnTx.hash);

			// Stepper: attestation done â†’ mint active
			updateStepper("attest", "done");
			updateStepperLine("attest", "done");
			updateStepper("mint", "active");

			// 5. Mint on the destination chain
			btn.textContent = `Minting on ${toChain.shortName}...`;
			toast(`Switching wallet to ${toChain.name} to mint...`, "info");
			await switchChain(toChain.chainId);
			await refreshProvider();
			onAccountChange();
			// Defensive: the wallet must sit on the destination before receiveMessage.
			if (state.chainId !== toChain.chainId) {
				throw new Error("Wallet chain changed mid-flow â€” aborting before mint (no transaction was submitted)");
			}

			const mintTxId = "mint-" + Date.now();
			addTxEntry(mintTxId, `Mint ${amount} USDC on ${toChain.shortName}`, "pending", toKey);
			await submitMint(toChain, att, mintTxId, toKey, amount);
		}
	} catch (e) {
		if (state.txHistory.find(t => t.id === burnTxId && t.status === "pending")) {
			updateTxEntry(burnTxId, "failed", "");
		}
		if (subTxId && state.txHistory.find(t => t.id === subTxId && t.status === "pending")) {
			updateTxEntry(subTxId, "failed", "");
		}
		toast("Bridge failed: " + (e.reason || e.shortMessage || e.message || "Unknown error"), "error");
		// Mark the currently-active stepper step as failed
		["burn", "attest", "mint"].forEach(s => {
			const stepEl = el("step-" + s);
			if (stepEl && stepEl.classList.contains("active")) updateStepper(s, "failed");
		});
	}
}

// receiveMessage on the destination MessageTransmitterV2. Tolerates the case
// where a relayer already processed the nonce â€” then the funds HAVE arrived,
// which is a success, not an error.
async function submitMint(toChain, att, mintTxId, toKey, amount) {
	const transmitter = new ethers.Contract(toChain.cctp.messageTransmitterV2, MESSAGE_TRANSMITTER_V2_ABI, state.signer);
	const overrides = toKey === "arc"
		? { maxFeePerGas: ethers.parseUnits("30", "gwei"), maxPriorityFeePerGas: 0n }
		: {};
	try {
		const mintTx = await transmitter.receiveMessage(att.message, att.attestation, overrides);
		updateTxEntry(mintTxId, "pending", mintTx.hash);
		const mintReceipt = await mintTx.wait();
		if (mintReceipt.status === 1) {
			updateTxEntry(mintTxId, "success", mintTx.hash);
			toast(`Bridge complete! ${amount} USDC â†’ ${toChain.shortName}`, "success");
			clearPendingCctp();
			updateStepper("mint", "done");
		} else {
			updateTxEntry(mintTxId, "failed", mintTx.hash);
			toast("Mint transaction failed", "error");
			updateStepper("mint", "failed");
		}
	} catch (e) {
		const msg = String(e.reason || e.shortMessage || e.message || "");
		if (/already|replay|used/i.test(msg)) {
			updateTxEntry(mintTxId, "success", "");
			toast("Mint was already submitted by a relayer â€” funds are on " + toChain.shortName, "success");
			clearPendingCctp();
			updateStepper("mint", "done");
		} else {
			// Rejected/reverted mint: the burn is safe on-chain â€” KEEP the pending
			// record so the resume banner survives for a retry.
			updateTxEntry(mintTxId, "failed", "");
			updateStepper("mint", "failed");
			throw e;
		}
	} finally {
		loadBalances();
	}
}

// Forwarder stalled but Iris already signed the attestation â€” anyone may
// submit receiveMessage (destinationCaller = zero), so finish the mint by
// hand. submitMint clears the pending record on success, keeps it on failure.
async function manualMintFallback(toChain, toKey, att, amount, labelSuffix = " (manual fallback)") {
	toast("Forwarder belum selesai â€” melanjutkan dengan mint manualâ€¦", "info");
	await switchChain(toChain.chainId);
	await refreshProvider();
	onAccountChange();
	// Same defense as the other pre-mint paths: a silently-ignored chain switch
	// would send the mint to the wrong network (wasted gas â€” USDC on Arc).
	if (state.chainId !== toChain.chainId) {
		throw new Error(`Wallet is not on ${toChain.name} â€” mint aborted before send`);
	}
	const mintTxId = "mint-" + Date.now();
	addTxEntry(mintTxId, `Mint ${amount} USDC on ${toChain.shortName}${labelSuffix}`, "pending", toKey);
	await submitMint(toChain, att, mintTxId, toKey, amount);
}

// Resume an interrupted transfer after a reload: the burn hash is enough to
// redo either the attestation+mint (manual) or the forward-completion wait.
async function resumePendingCctp() {
	if (state.isBridging) { toast("Another bridge flow is in progress", "error"); return; }
	const p = loadPendingCctp();
	if (!p) return;
	if (!state.signer || !state.account) {
		toast("Connect your wallet first, then resume", "error");
		return;
	}
	const fromChain = CONFIG.chains[p.fromKey];
	const toChain = CONFIG.chains[p.toKey];
	if (!fromChain || !toChain || fromChain.network !== toChain.network) {
		clearPendingCctp();
		return;
	}

	state.isBridging = true;
	const btn = el("bridge-btn");
	setFlowsBusy(true);
	const resumeId = "resume-" + Date.now();

	try {
		if (p.forward) {
			addTxEntry(resumeId, `Forward mint on ${toChain.shortName} (Circle, resumed)`, "pending", p.toKey);
			let forwardHash;
			try {
				forwardHash = await pollForwardCompletion(CONFIG.iris[fromChain.network], fromChain.cctpDomain, p.burnHash);
			} catch (e) {
				if (e.name !== "ForwardTimeoutWithAttestation") throw e;
				updateTxEntry(resumeId, "failed", "");
				await manualMintFallback(toChain, p.toKey, e.att, p.amount, " (resumed, manual fallback)");
				return;
			}
			updateTxEntry(resumeId, "success", forwardHash);
			toast("Forward completed â€” funds are on " + toChain.shortName, "success");
			clearPendingCctp();
		} else {
			// The mint always pays the ORIGINAL recipient; a different connected
			// account only pays the gas â€” make that explicit before proceeding.
			if (p.recipient && state.account && p.recipient.toLowerCase() !== state.account.toLowerCase() &&
				!window.confirm("Burn ini dibuat untuk penerima " + shortAddr(p.recipient) + ", BUKAN akun yang tersambung sekarang. Mint manual akan mengirim dana ke penerima asli (gas dibayar akun sekarang). Lanjutkan?")) {
				return;
			}
			btn.textContent = "Waiting for attestation...";
			const att = await pollAttestation(CONFIG.iris[fromChain.network], fromChain.cctpDomain, p.burnHash);
			if (state.chainId !== toChain.chainId) {
				toast(`Switching wallet to ${toChain.name} to mint...`, "info");
				await switchChain(toChain.chainId);
				await refreshProvider();
				onAccountChange();
			}
			// Chain-only assertion: the account may differ from the burner (the
			// confirm above already covers that case).
			if (state.chainId !== toChain.chainId) {
				throw new Error("Wallet chain changed mid-flow â€” aborting before mint (no transaction was submitted)");
			}
			const mintTxId = "mint-" + Date.now();
			addTxEntry(mintTxId, `Mint ${p.amount} USDC on ${toChain.shortName} (resumed)`, "pending", p.toKey);
			await submitMint(toChain, att, mintTxId, p.toKey, p.amount);
		}
	} catch (e) {
		if (state.txHistory.find(t => t.id === resumeId && t.status === "pending")) {
			updateTxEntry(resumeId, "failed", "");
		}
		toast("Resume failed: " + (e.reason || e.shortMessage || e.message || "Unknown error"), "error");
	} finally {
		state.isBridging = false;
		setFlowsBusy(false);
		updateBridgeBtn();
	}
}

// For forwarded burns, completion = Iris reports the relayer's forwardTxHash
// (the mint itself was submitted by Circle on the destination chain).
async function pollForwardCompletion(irisBase, srcDomain, txHash, timeoutMs = 600000) {
	const url = `${irisBase}/v2/messages/${srcDomain}?transactionHash=${txHash}`;
	const fetchMsg = async () => {
		try {
			const res = await fetch(url);
			if (res.ok) {
				const data = await res.json();
				return (data && data.messages && data.messages[0]) || null;
			}
		} catch { /* transient network error â€” keep polling */ }
		return null;
	};
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const msg = await fetchMsg();
		if (msg && msg.forwardTxHash) {
			return msg.forwardTxHash;
		}
		await sleep(5000);
	}
	// Timeout: a signed attestation still lets the caller mint manually
	// (destinationCaller = zero) â€” surface it instead of dead-ending.
	const msg = await fetchMsg();
	if (msg && msg.status === "complete" && msg.message && msg.attestation) {
		const e = new Error("Forward completion timeout â€” attestation signed, manual mint possible");
		e.name = "ForwardTimeoutWithAttestation";
		e.att = msg;
		throw e;
	}
	throw new Error("Forward completion timeout â€” attestation not signed yet; Circle may still forward it, or resume later from this page");
}

// Poll Iris until the burn message is signed. 404 = not observed yet; 5s
// interval stays far below the 40 req/s attestation-service rate limit.
async function pollAttestation(irisBase, srcDomain, txHash, timeoutMs = 600000) {
	const url = `${irisBase}/v2/messages/${srcDomain}?transactionHash=${txHash}`;
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(url);
			if (res.ok) {
				const data = await res.json();
				const msg = data && data.messages && data.messages[0];
				if (msg && msg.status === "complete" && msg.message && msg.attestation) {
					return msg;
				}
			}
		} catch { /* transient network error â€” keep polling */ }
		await sleep(5000);
	}
	throw new Error("Attestation timeout â€” the burn succeeded; mint can be retried with the burn tx hash");
}

// ETH native bridge â€” multi-protocol fallback router.
// Tries protocols in order: Li.Fi â†’ Relay â†’ Across (if API key) â†’ Stargate V2 â†’ Socket/Bungee.
// Each bridgeViaXxx manages its own UI, tx entries, and errors. If one throws, the next is tried.
async function bridgeETHNative(amount, parsedAmount, fromKey, toKey) {
	const fromChain = CONFIG.chains[fromKey];
	const toChain = CONFIG.chains[toKey];

	if (fromChain.network !== toChain.network) {
		toast(t("networkMismatch"), "error");
		return;
	}
	if (fromChain.nativeCurrency.symbol !== "ETH" || toChain.nativeCurrency.symbol !== "ETH") {
		toast("ETH bridging only available on EVM chains (not Arc)", "error");
		return;
	}

	const protocols = [
		{ name: "Li.Fi",      fn: bridgeViaLiFi },
		{ name: "Relay",      fn: bridgeViaRelay },
	];
	const apiKeyAcross = CONFIG.ethBridge?.apiKeys?.across || "";
	if (apiKeyAcross) protocols.push({ name: "Across", fn: bridgeViaAcross });
	protocols.push(
		{ name: "Stargate V2",  fn: bridgeViaStargate },
		{ name: "Socket/Bungee",fn: bridgeViabungee }
	);

	for (const proto of protocols) {
		try {
			await proto.fn(amount, parsedAmount, fromKey, toKey);
			return; // success â€” stop here
		} catch (e) {
			console.warn(`[ETH Bridge] ${proto.name} failed: ${e.message}. Next...`);
		}
	}
	// All failed â€” the last bridgeViaXxx already showed its error toast
}

// Relay protocol bridge â€” intent-based, fastest fills (<3s p50)
async function bridgeViaRelay(amount, parsedAmount, fromKey, toKey) {
	const fromChain = CONFIG.chains[fromKey];
	const toChain = CONFIG.chains[toKey];

	if (fromChain.network !== toChain.network) {
		toast(t("networkMismatch"), "error");
		return;
	}

	const txId = "relay-" + Date.now();
	const btn = el("bridge-btn");
	setFlowsBusy(true);

	try {
		// Switch to source chain
		if (state.chainId !== fromChain.chainId) {
			toast(`${t("switchingTo")} ${fromChain.name}...`, "info");
			await switchChain(fromChain.chainId);
			await refreshProvider();
		}

		const token = getSelectedToken();
		btn.textContent = "Getting Relay quote...";
		addTxEntry(txId, `Bridge ${amount} ${token} â†’ ${toChain.shortName} (Relay)`, "pending", fromKey);

		// Get quote from Relay API
		const quote = await relayQuote(fromChain, toChain, parsedAmount, token);
		if (!quote || !quote.steps || !quote.steps.length) {
			throw new Error("Relay quote unavailable for this route");
		}

		updateQuoteDisplay(quote);
		btn.textContent = "Sending via Relay...";

		// Execute the bridge
		const result = await relayExecute(quote);

		updateTxEntry(txId, "success", result.txHash);
		toast(`${t("bridgeComplete")} ${amount} ${getSelectedToken()} \u2192 ${toChain.shortName} (Relay)`, "success");
		loadBalances();
	} catch (e) {
		updateTxEntry(txId, "failed", "");
		toast(`${t("bridgeFailed")}${e.reason || e.shortMessage || e.message || "Unknown error"}`, "error");
	} finally {
		setFlowsBusy(false);
		updateBridgeBtn();
	}
}
// Across Protocol bridge â€” fastest fills (~2s). Requires API key.
async function bridgeViaAcross(amount, parsedAmount, fromKey, toKey) {
	const fromChain = CONFIG.chains[fromKey];
	const toChain = CONFIG.chains[toKey];

	if (fromChain.network !== toChain.network) {
		throw new Error("Network mismatch");
	}

	const txId = "across-" + Date.now();
	const btn = el("bridge-btn");
	setFlowsBusy(true);

	try {
		if (state.chainId !== fromChain.chainId) {
			toast(`${t("switchingTo")} ${fromChain.name}...`, "info");
			await switchChain(fromChain.chainId);
			await refreshProvider();
		}

		const token = getSelectedToken();
		btn.textContent = "Getting Across quote...";
		addTxEntry(txId, `Bridge ${amount} ${token} â†’ ${toChain.shortName} (Across)`, "pending", fromKey);

		const quote = await acrossQuote(fromChain, toChain, parsedAmount, token);
		if (!quote || !quote.swapTx) {
			throw new Error("Across quote unavailable for this route");
		}

		updateQuoteDisplay(quote);
		btn.textContent = "Sending via Across...";

		const result = await acrossExecute(quote);

		updateTxEntry(txId, "success", result.txHash);
		toast(`${t("bridgeComplete")} ${amount} ${getSelectedToken()} \u2192 ${toChain.shortName} (Across)`, "success");
		loadBalances();
	} catch (e) {
		updateTxEntry(txId, "failed", "");
		toast(`${t("bridgeFailed")}${e.reason || e.shortMessage || e.message || "Unknown error"}`, "error");
		throw e; // re-throw for multi-protocol fallback
	} finally {
		setFlowsBusy(false);
		updateBridgeBtn();
	}
}

// Stargate V2 bridge â€” LayerZero-based, direct contract interaction.
async function bridgeViaStargate(amount, parsedAmount, fromKey, toKey) {
	const fromChain = CONFIG.chains[fromKey];
	const toChain = CONFIG.chains[toKey];

	if (fromChain.network !== toChain.network) {
		throw new Error("Network mismatch");
	}

	const txId = "stargate-" + Date.now();
	const btn = el("bridge-btn");
	setFlowsBusy(true);

	try {
		if (state.chainId !== fromChain.chainId) {
			toast(`${t("switchingTo")} ${fromChain.name}...`, "info");
			await switchChain(fromChain.chainId);
			await refreshProvider();
		}

		btn.textContent = "Getting Stargate quote...";
		addTxEntry(txId, `Bridge ${amount} ${getSelectedToken()} \u2192 ${toChain.shortName} (Stargate V2)`, "pending", fromKey);

		const quote = await stargateQuote(fromChain, toChain, parsedAmount, "ETH");
		if (!quote || !quote.dstChainId) {
			throw new Error("Stargate quote unavailable for this route");
		}

		updateQuoteDisplay(quote);
		btn.textContent = "Sending via Stargate...";

		const result = await stargateExecute(quote, fromKey, toKey, parsedAmount);

		updateTxEntry(txId, "success", result.txHash);
		toast(`${t("bridgeComplete")} ${amount} ${getSelectedToken()} \u2192 ${toChain.shortName} (Stargate V2)`, "success");
		loadBalances();
	} catch (e) {
		updateTxEntry(txId, "failed", "");
		toast(`${t("bridgeFailed")}${e.reason || e.shortMessage || e.message || "Unknown error"}`, "error");
		throw e; // re-throw for multi-protocol fallback
	} finally {
		setFlowsBusy(false);
		updateBridgeBtn();
	}
}

// Socket/Bungee bridge â€” cross-chain routing engine.
async function bridgeViabungee(amount, parsedAmount, fromKey, toKey) {
	const fromChain = CONFIG.chains[fromKey];
	const toChain = CONFIG.chains[toKey];

	if (fromChain.network !== toChain.network) {
		throw new Error("Network mismatch");
	}

	const txId = "socket-" + Date.now();
	const btn = el("bridge-btn");
	setFlowsBusy(true);

	try {
		if (state.chainId !== fromChain.chainId) {
			toast(`${t("switchingTo")} ${fromChain.name}...`, "info");
			await switchChain(fromChain.chainId);
			await refreshProvider();
		}

		btn.textContent = "Getting Socket quote...";
		addTxEntry(txId, `Bridge ${amount} ${getSelectedToken()} \u2192 ${toChain.shortName} (Socket)`, "pending", fromKey);

		const quote = await socketQuote(fromChain, toChain, parsedAmount, "ETH");
		if (!quote || !quote.route) {
			throw new Error("Socket quote unavailable for this route");
		}

		updateQuoteDisplay(quote);
		btn.textContent = "Sending via Socket...";

		const result = await socketExecute(quote);

		updateTxEntry(txId, "success", result.txHash);
		toast(`${t("bridgeComplete")} ${amount} ${getSelectedToken()} \u2192 ${toChain.shortName} (Socket)`, "success");
		loadBalances();
	} catch (e) {
		updateTxEntry(txId, "failed", "");
		toast(`${t("bridgeFailed")}${e.reason || e.shortMessage || e.message || "Unknown error"}`, "error");
		throw e; // re-throw for multi-protocol fallback
	} finally {
		setFlowsBusy(false);
		updateBridgeBtn();
	}
}

// Li.Fi protocol bridge â€” aggregator routing through 20+ bridges
async function bridgeViaLiFi(amount, parsedAmount, fromKey, toKey) {
	const fromChain = CONFIG.chains[fromKey];
	const toChain = CONFIG.chains[toKey];

	if (fromChain.network !== toChain.network) {
		toast(t("networkMismatch"), "error");
		return;
	}

	const txId = "lifi-" + Date.now();
	const btn = el("bridge-btn");
	setFlowsBusy(true);

	try {
		// Switch to source chain
		if (state.chainId !== fromChain.chainId) {
			toast(`${t("switchingTo")} ${fromChain.name}...`, "info");
			await switchChain(fromChain.chainId);
			await refreshProvider();
		}

		const token = getSelectedToken();
		btn.textContent = "Getting Li.Fi quote...";
		addTxEntry(txId, `Bridge ${amount} ${token} â†’ ${toChain.shortName} (Li.Fi)`, "pending", fromKey);

		// Get quote from Li.Fi API
		const quote = await lifiQuote(fromChain, toChain, parsedAmount, token);
		if (!quote || !quote.transactionRequest) {
			throw new Error("Li.Fi quote unavailable for this route");
		}

		updateQuoteDisplay(quote);
		btn.textContent = `Sending via ${quote.tool || "Li.Fi"}...`;

		// Execute the bridge
		const result = await lifiExecute(quote);

		updateTxEntry(txId, "success", result.txHash);
		toast(`${t("bridgeComplete")} ${amount} ${getSelectedToken()} \u2192 ${toChain.shortName} (Li.Fi)`, "success");
		loadBalances();
	} catch (e) {
		updateTxEntry(txId, "failed", "");
		toast(`${t("bridgeFailed")}${e.reason || e.shortMessage || e.message || "Unknown error"}`, "error");
	} finally {
		setFlowsBusy(false);
		updateBridgeBtn();
	}
}

// Both action buttons go quiet while any bridge/resume flow runs; only the
// disabled state is touched â€” labels stay owned by updateBridgeBtn/the flow.
function setFlowsBusy(busy) {
	const b = el("bridge-btn");
	if (b) b.disabled = busy;
	const r = el("resume-btn");
	if (r) r.disabled = busy;
}

function updateBridgeBtn() {
	const btn = el("bridge-btn");
	const account = state.account;
	const fromKey = el("from-chain").value;
	const toKey = el("to-chain").value;
	const amount = el("amount").value.trim();
	const token = getSelectedToken();

	if (!account) { btn.textContent = t("connectWallet"); btn.disabled = false; return; }
	if (fromKey === toKey) { btn.textContent = t("sameChain"); btn.disabled = true; return; }

	if (token === "USDC") {
		// Arc â†’ requires CCTP V2; EVM non-Arc â†’ just needs USDC token address (protocols handle the bridge)
		const isArc = fromKey === "arc" || fromKey === "arcMainnet" || toKey === "arc" || toKey === "arcMainnet";
		if (isArc) {
			if (!CONFIG.tokens.USDC.addresses[fromKey] || !CONFIG.chains[fromKey].cctp) {
				btn.textContent = t("usdcBridgingUnavailable") + " " + CONFIG.chains[fromKey].shortName;
				btn.disabled = true;
				return;
			}
		} else {
			if (!CONFIG.tokens.USDC.addresses[fromKey]) {
				btn.textContent = "USDC not available on " + CONFIG.chains[fromKey].shortName;
				btn.disabled = true;
				return;
			}
		}
	} else if (token === "ETH") {
		// ETH bridging: only on chains with ETH as native currency (not Arc)
		const fromChain = CONFIG.chains[fromKey];
		const toChain = CONFIG.chains[toKey];
		if (!fromChain || !fromChain.nativeCurrency || fromChain.nativeCurrency.symbol !== "ETH") {
			btn.textContent = "ETH not available on " + (fromChain ? fromChain.shortName : fromKey);
			btn.disabled = true;
			return;
		}
		if (!toChain || !toChain.nativeCurrency || toChain.nativeCurrency.symbol !== "ETH") {
			btn.textContent = "ETH not available on " + (toChain ? toChain.shortName : toKey);
			btn.disabled = true;
			return;
		}
	}

	if (!amount || Number(amount) <= 0) { btn.textContent = t("enterAmount"); btn.disabled = true; return; }

	btn.textContent = `${t("bridgeToken")} ${amount} ${token} ${t("to")} ${CONFIG.chains[toKey].shortName}`;
	btn.disabled = false;
}

// A chain is bridgeable in the UI. For USDC: if Arc â†’ requires CCTP V2 contracts;
// if EVM non-Arc â†’ only needs a USDC token address (bridged via LiFi/etc. backend).
// For ETH (cross-chain bridging via LiFi/Across/Stargate/Relay/Socket) we only
// need the chain to support ETH as native currency â€” no CCTP needed.
function isBridgeableChain(chainKey, token) {
	const c = CONFIG.chains[chainKey];
	if (!c || c.disabled) return false;
	if (token === "ETH") {
		// ETH bridging: must use ETH as native gas token, exclude Arc
		if (chainKey === "arc" || chainKey === "arcMainnet") return false;
		return c.nativeCurrency && c.nativeCurrency.symbol === "ETH";
	}
	if (token === "USDC") {
		// Arc â†’ only via CCTP (must have CCTP contracts)
		if (chainKey === "arc" || chainKey === "arcMainnet") {
			return !!(c.cctpDomain != null && c.cctp && c.cctp.tokenMessengerV2);
		}
		// EVM non-Arc â†’ bridge via configured protocols (LiFi/Relay/etc.),
		// just need a USDC token address â€” no CCTP required here
		return !!CONFIG.tokens.USDC.addresses[chainKey];
	}
	// ABT bridging: requires Circle CCTP V2 contracts on the route
	return !!(c.cctpDomain != null && c.cctp && c.cctp.tokenMessengerV2);
}

function getFilteredChains() {
	const mode = state.testnetMode ? "testnet" : "mainnet";
	const token = getSelectedToken();
	return Object.keys(CONFIG.chains).filter(k => {
		const c = CONFIG.chains[k];
		if (c.network !== mode) return false;
		return isBridgeableChain(k, token);
	});
}

function populateChainSelects() {
	const from = el("from-chain");
	const to = el("to-chain");
	from.innerHTML = "";
	to.innerHTML = "";
	const keys = getFilteredChains();
	keys.forEach(k => {
		const c = CONFIG.chains[k];
		const opt = `<option value="${k}">${c.name}</option>`;
		from.insertAdjacentHTML("beforeend", opt);
		to.insertAdjacentHTML("beforeend", opt);
	});
	if (keys.length > 0) {
		const arcIndex = keys.indexOf("arc");
		if (arcIndex >= 0) {
			// Prefer Arc as the default destination (the product's home chain):
			// fund it from the first partner testnet.
			to.value = "arc";
			from.value = keys.find(k => k !== "arc") || keys[0];
		} else {
			from.value = keys[0];
			to.value = keys[1] || keys[0];
		}
		if (from.value === to.value) to.value = keys.find(k => k !== from.value) || keys[0];
	}
}

function onChainChange() {
	const fromKey = el("from-chain").value;
	const toKey = el("to-chain").value;

	if (fromKey === toKey) {
		const keys = getFilteredChains();
		const next = keys.find(k => k !== fromKey);
		if (next) el("to-chain").value = next;
	}

	updateContractInfo();
	updateBridgeBtn();
	updateProtocolUI(); // Update protocol selector based on route
	if (state.account) loadBalances();
	estimateGas();
}

function onAmountChange() {
	updateBridgeBtn();
	estimateGas();
}

function onTokenChange() {
	const token = getSelectedToken();
	const meta = CONFIG.tokens[token];
	const img = el("token-tag").querySelector("img");
	const sym = el("token-symbol");
	img.src = meta.icon || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%232775CA'/%3E%3Cpath d='M16 7v18M20.8 11.2c-.8-1.2-2.6-1.9-4.8-1.9-2.7 0-4.7 1.3-4.7 3.3 0 4.4 9.6 2.4 9.6 6.7 0 2.1-2.1 3.4-5.1 3.4-2.5 0-4.3-.9-5.1-2.2' stroke='%23fff' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E";
	sym.textContent = meta.symbol;

	// Forwarding Service only exists on the CCTP USDC path
	const forwardRow = el("forward-row");
	if (forwardRow) forwardRow.style.display = token === "USDC" ? "flex" : "none";

	// Repopulate chain selects when token changes (ETH excludes Arc)
	populateChainSelects();
	onChainChange();

	if (state.account) loadBalances();
	estimateGas();
	updateBridgeBtn();
	updateContractInfo();
}

function setMax() {
	const token = getSelectedToken();
	const decimals = token === "USDC" ? 6 : 18;
	const places = token === "USDC" ? 2 : 6;
	if (state.lastFromBalanceRaw != null) {
		el("amount").value = truncateUnits(state.lastFromBalanceRaw, decimals, places);
		updateBridgeBtn();
		estimateGas();
		return;
	}
	const bal = el("from-balance").textContent;
	if (bal && bal !== "0.00" && bal !== "N/A") {
		el("amount").value = bal;
		updateBridgeBtn();
		estimateGas();
	}
}

// ---------------------------------------------------------------------------
// Chain swap (interactive arrow button)
// ---------------------------------------------------------------------------

function swapChains() {
	const from = el("from-chain");
	const to = el("to-chain");
	const tmp = from.value;
	from.value = to.value;
	to.value = tmp;
	// Animate the swap icon
	const btn = el("swap-chains-btn");
	if (btn) {
		btn.classList.add("swapped");
		setTimeout(() => btn.classList.remove("swapped"), 300);
	}
	onChainChange();
}

// ---------------------------------------------------------------------------
// Preset amount buttons (25% / 50% / 75%)
// ---------------------------------------------------------------------------

function setPresetAmount(pct) {
	if (state.lastFromBalanceRaw == null || state.lastFromBalanceRaw === 0n) return;
	const token = getSelectedToken();
	const decimals = token === "USDC" ? 6 : 18;
	const places = token === "USDC" ? 2 : 4;
	const portion = state.lastFromBalanceRaw * BigInt(pct) / 100n;
	el("amount").value = truncateUnits(portion, decimals, places);
	updateBridgeBtn();
	estimateGas();
}

// ---------------------------------------------------------------------------
// CCTP V2 Step Tracker
// ---------------------------------------------------------------------------

function updateStepper(step, state) {
	const stepEl = el("step-" + step);
	if (!stepEl) return;
	// Clear previous states
	stepEl.classList.remove("active", "done", "failed");
	if (state) stepEl.classList.add(state);
}

function updateStepperLine(line, state) {
	const lineEl = el("line-" + line);
	if (!lineEl) return;
	lineEl.classList.remove("active", "done");
	if (state) lineEl.classList.add(state);
}

function showStepper() {
	const stepper = el("cctp-stepper");
	if (stepper) stepper.style.display = "flex";
}

function hideStepper() {
	const stepper = el("cctp-stepper");
	if (stepper) stepper.style.display = "none";
}

function resetStepper() {
	["burn", "attest", "mint"].forEach(s => updateStepper(s, null));
	["burn", "attest"].forEach(l => updateStepperLine(l, null));
	hideStepper();
}

// ---------------------------------------------------------------------------
// Wallet picker modal + WalletConnect (EIP-6963 rows are rendered by
// openWalletModal from window.WalletRegistry.discovered â€” see wallets.js).
// ---------------------------------------------------------------------------

// Neutral glyph for wallets that announce no icon (EIP-6963 icon is optional).
// Inline data URI keeps the strict CSP happy â€” no extra img-src host needed.
const GENERIC_WALLET_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect x='3' y='7' width='26' height='18' rx='3' fill='%232775CA'/%3E%3Crect x='18' y='14' width='11' height='7' rx='2' fill='%231E5FA8'/%3E%3Ccircle cx='23.5' cy='17.5' r='1.4' fill='%23FFFFFF'/%3E%3C/svg%3E";

// Memoized EthereumProvider init; the live instance is also cached on window
// (__wcProvider) so a second modal pass never re-imports/re-initializes.
let wcInitPromise = null;

async function initWalletConnect() {
	// Read at CALL time â€” projectId may be filled into config.js between loads.
	const wcConfig = CONFIG.walletconnect || {};
	if (!wcConfig.projectId || wcConfig.projectId === "TBD") throw { code: "NO_PROJECT" };
	if (window.__wcProvider) return window.__wcProvider;
	if (!wcInitPromise) {
		wcInitPromise = (async () => {
			// SRI cannot cover a transitive ESM graph; pinning the major version
			// (+ CONFIG.walletconnect.sdkVersion) against jsdelivr's official npm
			// mirror is the practical mitigation.
			const mod = await import(`https://cdn.jsdelivr.net/npm/@walletconnect/ethereum-provider@${wcConfig.sdkVersion}/+esm`);
			const EthereumProvider = mod.EthereumProvider ||
				(mod.default && mod.default.EthereumProvider) || mod.default;
			const chains = ["ethereum", "base", "arbitrum", "optimism"]
				.map(k => CONFIG.chains[k] && CONFIG.chains[k].chainId)
				.filter(id => id != null);
			const optionalChains = Object.values(CONFIG.chains)
				.filter(c => c.network === "testnet" && c.chainId != null)
				.map(c => c.chainId);
			const rpcMap = {};
			for (const c of Object.values(CONFIG.chains)) {
				if (c.chainId != null && c.rpcUrl != null) rpcMap[c.chainId] = c.rpcUrl;
			}
			return await EthereumProvider.init({
				projectId: wcConfig.projectId,
				chains,
				optionalChains,
				methods: ["eth_requestAccounts", "eth_accounts", "eth_chainId", "eth_sendTransaction", "personal_sign", "wallet_switchEthereumChain", "wallet_addEthereumChain"],
				events: ["chainChanged", "accountsChanged"],
				showQrModal: true,
				metadata: {
					name: "WarpArc",
					description: "USDC bridge via Circle CCTP V2",
					url: location.origin,
					icons: []
				},
				rpcMap
			});
		})();
		// Reset the memo on failure so the next click can retry the import.
		wcInitPromise.catch(() => { wcInitPromise = null; });
	}
	const provider = await wcInitPromise;
	window.__wcProvider = provider;
	return provider;
}

async function ensureWalletConnect() {
	try {
		return await initWalletConnect();
	} catch (e) {
		// Unconfigured project = expected state: stay silent (no toast, no
		// network activity), the row simply shows its disabled copy.
		if (e && e.code === "NO_PROJECT") return null;
		toast("WalletConnect failed: " + (e && e.message ? e.message : String(e)), "error");
		return null;
	}
}

function renderWcRowState() {
	const row = el("wc-row");
	const sub = row.querySelector(".wallet-sub");
	const projectId = CONFIG.walletconnect && CONFIG.walletconnect.projectId;
	const enabled = Boolean(projectId) && projectId !== "TBD";
	row.classList.toggle("disabled", !enabled);
	if (enabled) row.removeAttribute("disabled");
	else row.setAttribute("disabled", "");
	row.classList.remove("connecting");
	row.removeAttribute("aria-busy");
	if (sub) sub.textContent = enabled ? "Scan QR with any mobile wallet" : "Needs projectId in js/config.js";
}

let walletModalReturnFocus = null;

function modalFocusables() {
	return Array.from(el("wallet-modal").querySelectorAll("button, [role='button']"))
		.filter(n => !n.disabled && !n.classList.contains("disabled"));
}

function openWalletModal() {
	// Rows render at OPEN time â€” discovery results and CONFIG may differ per load.
	const installed = el("wallet-list-installed");
	installed.innerHTML = "";
	const entries = window.WalletRegistry ? window.WalletRegistry.discovered : [];
	if (entries.length === 0) {
		const li = document.createElement("li");
		li.className = "wallet-empty";
		li.textContent = "No browser wallet detected - install MetaMask or Rabby, or use WalletConnect.";
		installed.appendChild(li);
	} else {
		for (const entry of entries) {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "wallet-row";
			const img = document.createElement("img");
			img.className = "wallet-icon";
			img.alt = "";
			img.src = entry.info.icon || GENERIC_WALLET_ICON;
			const meta = document.createElement("span");
			meta.className = "wallet-meta";
			const name = document.createElement("span");
			name.className = "wallet-name";
			name.textContent = entry.info.name;
			meta.appendChild(name);
			btn.appendChild(img);
			btn.appendChild(meta);
			btn.addEventListener("click", () => {
				connectWith(entry.provider, entry.info.name, "injected");
			});
			installed.appendChild(btn);
		}
	}
	renderWcRowState();

	walletModalReturnFocus = document.activeElement;
	el("wallet-modal").hidden = false;
	// Initial focus lands on the first ENABLED row (not the header's close button).
	const firstRow = el("wallet-modal").querySelector(".wallet-row:not(.disabled)");
	(firstRow || el("wc-row")).focus();
}

function closeWalletModal() {
	const modal = el("wallet-modal");
	const wasOpen = !modal.hidden;
	modal.hidden = true;
	if (!wasOpen) return; // silent auto-reconnect: never steal focus on load
	const btn = el("connect-btn");
	if (btn && typeof btn.focus === "function") btn.focus();
	else if (walletModalReturnFocus && typeof walletModalReturnFocus.focus === "function") {
		walletModalReturnFocus.focus();
	}
}

// Escape closes; Tab wraps inside the panel (light focus trap). One gated
// listener instead of add/remove churn while the modal opens/closes.
function onModalKeydown(e) {
	if (el("wallet-modal").hidden) return;
	if (e.key === "Escape") {
		closeWalletModal();
		return;
	}
	if (e.key !== "Tab") return;
	const focusables = modalFocusables();
	if (focusables.length === 0) return;
	const first = focusables[0];
	const last = focusables[focusables.length - 1];
	if (e.shiftKey && document.activeElement === first) {
		e.preventDefault();
		last.focus();
	} else if (!e.shiftKey && document.activeElement === last) {
		e.preventDefault();
		first.focus();
	}
}

async function onWalletConnectRow() {
	const row = el("wc-row");
	if (row.classList.contains("disabled") || state.isConnecting) return;
	row.classList.add("connecting");
	row.setAttribute("aria-busy", "true");
	const sub = row.querySelector(".wallet-sub");
	if (sub) sub.textContent = "Opening QR...";
	const p = await ensureWalletConnect();
	if (!p) {
		renderWcRowState();
		return;
	}
	try {
		// A persisted session reconnects WITHOUT reopening the QR modal.
		if (!(p.session && Array.isArray(p.accounts) && p.accounts.length > 0)) {
			await p.connect();
		}
	} catch (e) {
		toast("Connection rejected", "error");
		renderWcRowState();
		return;
	}
	await connectWith(p, "WalletConnect", "walletconnect");
	// Success closed the modal; a rejection leaves it up â€” reset either way.
	renderWcRowState();
}

// Shared connect path for every picker row (injected or WalletConnect).
// Mirrors the classic flow: eth_requestAccounts -> BrowserProvider -> signer
// -> eth_chainId. opts.silent skips the button flicker (auto-reconnect only).
async function connectWith(eip1193, label, type, opts = {}) {
	if (state.isConnecting) return;
	state.isConnecting = true;
	if (!opts.silent) updateConnectBtn("Connecting...");
	try {
		const accounts = await eip1193.request({ method: "eth_requestAccounts" });
		// Set FIRST so every downstream read routes through the picked provider.
		state.wallet = { eip1193, type, label };
		state.provider = new ethers.BrowserProvider(eip1193);
		state.signer = await state.provider.getSigner();
		state.account = accounts[0];
		state.chainId = Number(await eip1193.request({ method: "eth_chainId" }));
		// Persist the pick for silent reloads â€” rdns preferred, display name as
		// fallback when no EIP-6963 entry carries it.
		const match = (window.WalletRegistry ? window.WalletRegistry.discovered : [])
			.find(e => e.info.name === label);
		const pref = { type };
		if (type === "injected") {
			pref.rdns = (match && match.info.rdns) || label;
			pref.label = label;
		}
		try { localStorage.setItem(WALLET_PREF_KEY, JSON.stringify(pref)); } catch { }
		bindWalletEvents(eip1193);
		onAccountChange();
		closeWalletModal();
	renderWalletChainPicker();
	} catch (e) {
		toast("Connection rejected: " + e.message, "error");
		updateConnectBtn("Connect Wallet");
	} finally {
		state.isConnecting = false;
	}
}

// Wire accountsChanged/chainChanged for the ACTIVE provider. Rebinding for a
// different provider always detaches the previous handlers first â€” switching
// wallets (or reconnecting after a disconnect) never accumulates listeners.
function bindWalletEvents(p) {
	if (state._eventsBound && state._boundProvider === p) return;
	if (state._boundProvider) {
		if (state._accountsChanged) state._boundProvider.removeListener("accountsChanged", state._accountsChanged);
		if (state._chainChanged) state._boundProvider.removeListener("chainChanged", state._chainChanged);
	}
	state._accountsChanged = async (accounts) => {
		if (!Array.isArray(accounts)) return;
		// Stale event from an already-disconnected provider â€” ignore quietly.
		if (!state.wallet) return;
		if (accounts.length === 0) {
			disconnectWallet();
			return;
		}
		state.account = accounts[0];
		state.provider = new ethers.BrowserProvider(state.wallet.eip1193);
		state.signer = await state.provider.getSigner();
		onAccountChange();
	};
	state._chainChanged = async (chainId) => {
		state.chainId = Number(chainId);
		await refreshProvider();
		renderWalletChainPicker();
		onAccountChange();
	};
	p.on("accountsChanged", state._accountsChanged);
	p.on("chainChanged", state._chainChanged);
	state._boundProvider = p;
	state._eventsBound = true;
}

// Silent reconnect after a reload. Injected wallets answer eth_accounts with
// no prompt; a WalletConnect session persists in ITS storage, so a live
// session is adopted without calling connect()/showing the QR again.
async function autoReconnect() {
	let pref = null;
	try { pref = JSON.parse(localStorage.getItem(WALLET_PREF_KEY)); } catch { }
	if (!pref || typeof pref !== "object" || !pref.type) return;
	try {
		if (pref.type === "injected") {
			const entries = window.WalletRegistry ? window.WalletRegistry.discovered : [];
			const entry = entries.find(e => e.info.rdns === pref.rdns) ||
				entries.find(e => e.info.name === pref.label) ||
				entries.find(e => e.info.name === pref.rdns);
			if (!entry) return;
			const accounts = await entry.provider.request({ method: "eth_accounts" });
			if (Array.isArray(accounts) && accounts.length > 0) {
				await connectWith(entry.provider, entry.info.name, "injected", { silent: true });
			}
		} else if (pref.type === "walletconnect") {
			const projectId = CONFIG.walletconnect && CONFIG.walletconnect.projectId;
			if (!projectId || projectId === "TBD") return;
			const p = await ensureWalletConnect();
			if (!p || !p.session || !Array.isArray(p.accounts) || p.accounts.length === 0) return;
			state.wallet = { eip1193: p, type: "walletconnect", label: "WalletConnect" };
			bindWalletEvents(p);
			state.provider = new ethers.BrowserProvider(p);
			state.signer = await state.provider.getSigner();
			state.account = p.accounts[0];
			state.chainId = Number(await p.request({ method: "eth_chainId" }));
			onAccountChange();
			renderWalletChainPicker();
		}
	} catch {
		// Auto-reconnect must never surface errors or toasts.
	}
}

document.addEventListener("DOMContentLoaded", () => {
	// EIP-6963 discovery (+ the legacy injected fallback) lives in wallets.js;
	// wait out its 400ms grace window, then silently replay any saved pick.
	if (window.WalletRegistry) window.WalletRegistry.start();
	setTimeout(autoReconnect, 450);

	el("from-chain").addEventListener("change", onChainChange);
	el("to-chain").addEventListener("change", onChainChange);
	el("token-select").addEventListener("change", onTokenChange);
	el("amount").addEventListener("input", onAmountChange);

	// Bound in JS (not inline onclick) so the strict CSP in vercel.json â€”
	// script-src 'self' + cdnjs, no 'unsafe-inline' â€” cannot block them.
	el("connect-btn").addEventListener("click", openWalletModal);
	el("wallet-modal-close").addEventListener("click", closeWalletModal);
	el("wallet-modal").addEventListener("click", (e) => {
		if (e.target === el("wallet-modal")) closeWalletModal();
	});
	const wcRow = el("wc-row");
	wcRow.addEventListener("click", onWalletConnectRow);
	wcRow.addEventListener("keydown", (e) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			onWalletConnectRow();
		}
	});
	document.addEventListener("keydown", onModalKeydown);
	el("max-btn").addEventListener("click", setMax);
	el("bridge-btn").addEventListener("click", bridge);
	el("wallet-chain").addEventListener("change", onWalletChainChange);
	renderWalletChainPicker();

	// Chain swap button
	const swapBtn = el("swap-chains-btn");
	if (swapBtn) {
		swapBtn.addEventListener("click", swapChains);
	}

	// Preset amount buttons (25%, 50%, 75%)
	document.querySelectorAll(".preset-btn").forEach(btn => {
		btn.addEventListener("click", () => {
			const pct = Number(btn.dataset.pct);
			if (pct > 0) setPresetAmount(pct);
		});
	});

	const forwardToggle = el("forward-toggle");
	if (forwardToggle) {
		forwardToggle.addEventListener("change", estimateGas);
	}

	const resumeBtn = el("resume-btn");
	if (resumeBtn) {
		resumeBtn.addEventListener("click", resumePendingCctp);
	}
	const dismissBtn = el("pending-dismiss");
	if (dismissBtn) {
		dismissBtn.addEventListener("click", () => {
			const p = loadPendingCctp();
			// Forwarded transfers complete on their own â€” dismiss clears the
			// state. Manual ones stay resumable; dismiss only hides the banner.
			if (p && p.forward) clearPendingCctp();
			else el("pending-resume").style.display = "none";
		});
	}

	// Network toggle buttons (Mainnet / Testnet)
	const mainnetBtn = el("network-mainnet-btn");
	const testnetBtn = el("network-testnet-btn");
	function setNetworkMode(isTestnet) {
		state.testnetMode = isTestnet;
		if (mainnetBtn) mainnetBtn.classList.toggle("active", !isTestnet);
		if (testnetBtn) testnetBtn.classList.toggle("active", isTestnet);
		populateChainSelects();
		onChainChange();
		renderWalletChainPicker();
	}
	if (mainnetBtn) mainnetBtn.addEventListener("click", () => setNetworkMode(false));
	if (testnetBtn) testnetBtn.addEventListener("click", () => setNetworkMode(true));
	// Initialize button state
	setNetworkMode(state.testnetMode);

	// Language selector
	const langBtn = el("lang-btn");
	const langDropdown = el("lang-dropdown");
	if (langBtn && langDropdown) {
		langBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			langDropdown.classList.toggle("open");
		});
		document.addEventListener("click", (e) => {
			if (!langDropdown.contains(e.target) && e.target !== langBtn) {
				langDropdown.classList.remove("open");
			}
		});
		langDropdown.querySelectorAll(".lang-option").forEach((opt) => {
			opt.addEventListener("click", () => {
				const lang = opt.getAttribute("data-lang");
				setLanguage(lang);
				langDropdown.classList.remove("open");
			});
		});
	}
	initLanguage();

	// Protocol selector
	initProtocol();
	document.querySelectorAll(".protocol-row[data-protocol]").forEach((row) => {
		row.addEventListener("click", () => {
			const proto = row.getAttribute("data-protocol");
			setProtocol(proto);
		});
	});

	loadTxHistory();
	renderTxHistory();
	showPendingBanner();
	populateChainSelects();
	onTokenChange();
	updateBridgeBtn();

	// Start in disconnected state â€” card shows form but muted
	const card = document.querySelector(".bridge-card");
	if (card && !state.account) card.classList.add("disconnected");
});

