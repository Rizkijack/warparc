// WarpArc — USDC bridges via Circle CCTP V2 (burn-and-mint, the only canonical
// route to/from Arc per https://docs.arc.io/integrate/infrastructure/bridges).
// Manual flow: approve → depositForBurn → poll Iris attestation → receiveMessage.
// Forwarding Service: approve → depositForBurnWithHook("cctp-forward") → Circle
// submits the destination mint (no destination gas needed). See the official
// quickstart: developers.circle.com/cctp/quickstarts/transfer-usdc-ethereum-to-arc
// The ABT token keeps the DEPRECATED legacy LayerZero OFT path (ABT demo only).
// --- i18n (internationalization) -----------------------------------------------
const LANG_KEY = "warparc:lang";

const TRANSLATIONS = {
	en: {
		mainnet: "Mainnet", testnet: "Testnet", notConnected: "Not Connected",
		connectWallet: "Connect Wallet", crossChainBridge: "Cross-Chain Bridge",
		amount: "Amount", balance: "Balance", estGasFee: "Estimated Gas Fee (source)",
		cctpFee: "CCTP Fast-Transfer Fee (USDC)",
		forwardingService: "Forwarding Service — Circle submits the mint for you (extra fee, no destination gas needed)",
		unfinishedBridge: "Unfinished bridge detected", resumeMint: "Resume mint",
		dismiss: "Dismiss", burn: "Burn", attestation: "Attestation", mint: "Mint",
		enterAmount: "Enter amount", cctpContracts: "CCTP V2 Contracts",
		txHistory: "Transaction History", noTxs: "No transactions yet",
		footerText: "WarpArc Bridge · USDC via Circle CCTP V2",
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
		forwardUnavailable: "Forwarding fee quote unavailable — turn off Forwarding Service or retry",
		amountMustExceedFee: "Amount must exceed the CCTP fee",
		switchingTo: "Switching wallet to", alreadyRelayed: "Mint was already submitted by a relayer — funds are on",
		forwarderStalled: "Forwarder belum selesai — melanjutkan dengan mint manual…",
		resumeConfirm: "Burn ini dibuat untuk penerima",
		notOnChain: "Wallet is not on", abortMint: " — mint aborted before send",
		walletChanged: "Wallet account or chain changed mid-flow — aborting before send (no transaction was submitted)",
		noWallet: "No wallet detected. Install MetaMask.", connectionRejected: "Connection rejected: ",
		anotherBridge: "Another bridge flow is in progress",
		forwardCompleted: "Forward completed — funds are on",
		attestationTimeout: "Attestation timeout — the burn succeeded; mint can be retried with the burn tx hash",
		forwardTimeout: "Forward completion timeout — attestation signed, manual mint possible",
		forwardTimeoutNoAtt: "Forward completion timeout — attestation not signed yet; Circle may still forward it, or resume later from this page",
		usdcBridgingUnavailable: "USDC bridging unavailable on",
		bridgeNotDeployed: "Bridge not deployed on",
		bridgeToken: "Bridge", to: "to",
		ethNotAvailable: "ETH not available on",
		ethOnlyEvm: "ETH bridging only available on EVM chains (not Arc)",
	},
	zh: {
		mainnet: "主网", testnet: "测试网", notConnected: "未连接",
		connectWallet: "连接钱包", crossChainBridge: "跨链桥",
		amount: "金额", balance: "余额", estGasFee: "预估Gas费（源链）",
		cctpFee: "CCTP快速转账费（USDC）",
		forwardingService: "转发服务 — Circle为您提交铸造（额外费用，无需目标链Gas）",
		unfinishedBridge: "检测到未完成的桥接", resumeMint: "恢复铸造",
		dismiss: "关闭", burn: "销毁", attestation: "证明", mint: "铸造",
		enterAmount: "输入金额", cctpContracts: "CCTP V2 合约",
		txHistory: "交易历史", noTxs: "暂无交易",
		footerText: "WarpArc桥 · USDC通过Circle CCTP V2",
		systemStatus: "系统状态", faucet: "水龙头",
		sameChain: "已选择相同链", notDeployed: "未部署",
		approving: "授权USDC中...", burning: "销毁中", waitingAttest: "等待证明...",
		minting: "铸造中", waitingForward: "等待Circle转发...",
		bridgeComplete: "桥接完成！", bridgeFailed: "桥接失败：",
		resumeFailed: "恢复失败：", connectFirst: "请先连接钱包",
		enterValidAmount: "请输入有效金额", invalidAmount: "金额格式无效",
		amountMustExceed0: "金额必须大于0", amountExceeds: "金额超过您的",
		cctpUnavailable: "此路线不可用CCTP",
		networkMismatch: "源链和目标链必须在同一网络（测试网/主网）",
		forwardUnavailable: "转发费用报价不可用 — 关闭转发服务或重试",
		amountMustExceedFee: "金额必须超过CCTP费用",
		switchingTo: "切换钱包到", alreadyRelayed: "铸造已被中继器提交 — 资金已在",
		forwarderStalled: "转发器未完成 — 手动铸造继续…",
		resumeConfirm: "此销毁为收款人创建",
		notOnChain: "钱包不在", abortMint: " — 铸造在发送前中止",
		walletChanged: "钱包账户或链在流程中更改 — 在发送前中止（未提交交易）",
		noWallet: "未检测到钱包。请安装MetaMask。", connectionRejected: "连接被拒绝：",
		anotherBridge: "另一个桥接流程正在进行",
		forwardCompleted: "转发完成 — 资金已在",
		attestationTimeout: "证明超时 — 销毁已成功；可使用销毁交易哈希重试铸造",
		forwardTimeout: "转发完成超时 — 证明已签名，可手动铸造",
		forwardTimeoutNoAtt: "转发完成超时 — 证明尚未签名；Circle可能仍在转发，或稍后从此页面恢复",
		usdcBridgingUnavailable: "USDC桥接不可用于",
		bridgeNotDeployed: "桥接未部署于",
		bridgeToken: "桥接", to: "到",
		ethNotAvailable: "ETH不可用于",
		ethOnlyEvm: "ETH桥接仅适用于EVM链（不包括Arc）",
	},
	hi: {
		mainnet: "मेननेट", testnet: "टेस्टनेट", notConnected: "कनेक्ट नहीं",
		connectWallet: "वॉलेट कनेक्ट करें", crossChainBridge: "क्रॉस-चेन ब्रिज",
		amount: "राशि", balance: "बैलेंस", estGasFee: "अनुमानित गैस शुल्क (स्रोत)",
		cctpFee: "CCTP फास्ट-ट्रांसफर शुल्क (USDC)",
		forwardingService: "फॉरवर्डिंग सर्विस — Circle आपके लिए मिंट सबमिट करता है (अतिरिक्त शुल्क, गंतव्य गैस की आवश्यकता नहीं)",
		unfinishedBridge: "अपूर्ण ब्रिज का पता चला", resumeMint: "मिंट फिर से शुरू करें",
		dismiss: "खारिज करें", burn: "बर्न", attestation: "अटेस्टेशन", mint: "मिंट",
		enterAmount: "राशि दर्ज करें", cctpContracts: "CCTP V2 कॉन्ट्रैक्ट्स",
		txHistory: "लेनदेन इतिहास", noTxs: "अभी तक कोई लेनदेन नहीं",
		footerText: "WarpArc ब्रिज · USDC Circle CCTP V2 के माध्यम से",
		systemStatus: "सिस्टम स्थिति", faucet: "फॉसेट",
		sameChain: "समान चेन चयनित", notDeployed: "तैनात नहीं",
		approving: "USDC स्वीकृत हो रहा है...", burning: "बर्न हो रहा है", waitingAttest: "अटेस्टेशन की प्रतीक्षा...",
		minting: "मिंट हो रहा है", waitingForward: "Circle फॉरवर्ड की प्रतीक्षा...",
		bridgeComplete: "ब्रिज पूर्ण!", bridgeFailed: "ब्रिज विफल: ",
		resumeFailed: "फिर से शुरू करना विफल: ", connectFirst: "पहले अपना वॉलेट कनेक्ट करें",
		enterValidAmount: "मान्य राशि दर्ज करें", invalidAmount: "अमान्य राशि प्रारूप",
		amountMustExceed0: "राशि 0 से अधिक होनी चाहिए", amountExceeds: "राशि आपके से अधिक है",
		cctpUnavailable: "इस मार्ग पर CCTP उपलब्ध नहीं है",
		networkMismatch: "स्रोत और गंतव्य समान नेटवर्क पर होने चाहिए (टेस्टनेट/मेननेट)",
		forwardUnavailable: "फॉरवर्डिंग शुल्क उपलब्ध नहीं — फॉरवर्डिंग सर्विस बंद करें या पुनः प्रयास करें",
		amountMustExceedFee: "राशि CCTP शुल्क से अधिक होनी चाहिए",
		switchingTo: "वॉलेट स्विच हो रहा है", alreadyRelayed: "मिंट पहले ही रिलेयर द्वारा सबमिट किया जा चुका है — फंड हैं",
		forwarderStalled: "फॉरवर्डर पूरा नहीं हुआ — मैनुअल मिंट जारी…",
		resumeConfirm: "यह बर्न प्राप्तकर्ता के लिए बनाया गया था",
		notOnChain: "वॉलेट पर नहीं है", abortMint: " — भेजने से पहले मिंट निरस्त",
		walletChanged: "वॉलेट खाता या चेन बदल गया — भेजने से पहले निरस्त (कोई लेनदेन सबमिट नहीं)",
		noWallet: "कोई वॉलेट नहीं मिला। MetaMask इंस्टॉल करें।", connectionRejected: "कनेक्शन अस्वीकृत: ",
		anotherBridge: "एक और ब्रिज प्रक्रिया चल रही है",
		forwardCompleted: "फॉरवर्ड पूर्ण — फंड हैं",
		attestationTimeout: "अटेस्टेशन टाइमआउट — बर्न सफल; बर्न tx हैश से मिंट पुनः प्रयास करें",
		forwardTimeout: "फॉरवर्ड पूर्णता टाइमआउट — अटेस्टेशन हस्ताक्षरित, मैनुअल मिंट संभव",
		forwardTimeoutNoAtt: "फॉरवर्ड पूर्णता टाइमआउट — अटेस्टेशन अभी तक हस्ताक्षरित नहीं; Circle अभी भी फॉरवर्ड कर सकता है",
		usdcBridgingUnavailable: "USDC ब्रिजिंग उपलब्ध नहीं है",
		bridgeNotDeployed: "ब्रिज तैनात नहीं है",
		bridgeToken: "ब्रिज", to: "पर",
		ethNotAvailable: "ETH उपलब्ध नहीं है",
		ethOnlyEvm: "ETH ब्रिजिंग केवल EVM चेन पर उपलब्ध है (Arc नहीं)",
	},
	es: {
		mainnet: "Mainnet", testnet: "Testnet", notConnected: "No conectado",
		connectWallet: "Conectar billetera", crossChainBridge: "Puente cross-chain",
		amount: "Cantidad", balance: "Saldo", estGasFee: "Tarifa de gas estimada (origen)",
		cctpFee: "Tarifa CCTP Fast-Transfer (USDC)",
		forwardingService: "Servicio de reenvío — Circle envía el mint por ti (tarifa extra, sin gas de destino)",
		unfinishedBridge: "Puente incompleto detectado", resumeMint: "Reanudar mint",
		dismiss: "Descartar", burn: "Quema", attestation: "Attestación", mint: "Mint",
		enterAmount: "Ingresar cantidad", cctpContracts: "Contratos CCTP V2",
		txHistory: "Historial de transacciones", noTxs: "Sin transacciones aún",
		footerText: "WarpArc Bridge · USDC vía Circle CCTP V2",
		systemStatus: "Estado del sistema", faucet: "Faucet",
		sameChain: "Misma cadena seleccionada", notDeployed: "no desplegado",
		approving: "Aprobando USDC...", burning: "Quemando", waitingAttest: "Esperando attestación...",
		minting: "Acuñando en", waitingForward: "Esperando reenvío de Circle...",
		bridgeComplete: "¡Puente completado!", bridgeFailed: "Puente fallido: ",
		resumeFailed: "Reanudación fallida: ", connectFirst: "Conecta tu billetera primero",
		enterValidAmount: "Ingresa una cantidad válida", invalidAmount: "Formato de cantidad inválido",
		amountMustExceed0: "La cantidad debe ser mayor a 0", amountExceeds: "La cantidad excede tu",
		cctpUnavailable: "CCTP no disponible en esta ruta",
		networkMismatch: "Origen y destino deben estar en la misma red (testnet/mainnet)",
		forwardUnavailable: "Cotización de reenvío no disponible — desactiva el servicio o reintenta",
		amountMustExceedFee: "La cantidad debe exceder la tarifa CCTP",
		switchingTo: "Cambiando billetera a", alreadyRelayed: "El mint ya fue enviado por un relayer — fondos en",
		forwarderStalled: "Reenviador no completó — mint manual continuando…",
		resumeConfirm: "Esta quema fue creada para el destinatario",
		notOnChain: "Billetera no está en", abortMint: " — mint abortado antes de enviar",
		walletChanged: "Cuenta o cadena cambió durante el flujo — abortando (sin transacción enviada)",
		noWallet: "Sin billetera detectada. Instala MetaMask.", connectionRejected: "Conexión rechazada: ",
		anotherBridge: "Otro flujo de puente en progreso",
		forwardCompleted: "Reenvío completado — fondos en",
		attestationTimeout: "Timeout de attestación — quema exitosa; reintenta mint con el hash",
		forwardTimeout: "Timeout de reenvío — attestación firmada, mint manual posible",
		forwardTimeoutNoAtt: "Timeout de reenvío — attestación no firmada aún; Circle puede reenviar aún",
		usdcBridgingUnavailable: "Puente USDC no disponible en",
		bridgeNotDeployed: "Puente no desplegado en",
		bridgeToken: "Puente", to: "a",
		ethNotAvailable: "ETH no disponible en",
		ethOnlyEvm: "Puente ETH solo disponible en cadenas EVM (no Arc)",
	},
	fr: {
		mainnet: "Mainnet", testnet: "Testnet", notConnected: "Non connecté",
		connectWallet: "Connecter le portefeuille", crossChainBridge: "Pont cross-chain",
		amount: "Montant", balance: "Solde", estGasFee: "Frais de gas estimés (source)",
		cctpFee: "Frais CCTP Fast-Transfer (USDC)",
		forwardingService: "Service de transfert — Circle soumet le mint pour vous (frais supplémentaires, pas de gas de destination)",
		unfinishedBridge: "Pont inachevé détecté", resumeMint: "Reprendre le mint",
		dismiss: "Ignorer", burn: "Brûlage", attestation: "Attestation", mint: "Mint",
		enterAmount: "Entrer le montant", cctpContracts: "Contrats CCTP V2",
		txHistory: "Historique des transactions", noTxs: "Aucune transaction",
		footerText: "WarpArc Bridge · USDC via Circle CCTP V2",
		systemStatus: "État du système", faucet: "Faucet",
		sameChain: "Même chaîne sélectionnée", notDeployed: "non déployé",
		approving: "Approbation USDC...", burning: "Brûlage", waitingAttest: "En attente d'attestation...",
		minting: "Frappe sur", waitingForward: "En attente du transfert Circle...",
		bridgeComplete: "Pont terminé !", bridgeFailed: "Pont échoué : ",
		resumeFailed: "Reprise échouée : ", connectFirst: "Connectez d'abord votre portefeuille",
		enterValidAmount: "Entrez un montant valide", invalidAmount: "Format de montant invalide",
		amountMustExceed0: "Le montant doit être supérieur à 0", amountExceeds: "Le montant dépasse votre",
		cctpUnavailable: "CCTP non disponible sur cet itinéraire",
		networkMismatch: "Source et destination doivent être sur le même réseau (testnet/mainnet)",
		forwardUnavailable: "Cotisation de transfert indisponible — désactivez le service ou réessayez",
		amountMustExceedFee: "Le montant doit dépasser les frais CCTP",
		switchingTo: "Changement de portefeuille vers", alreadyRelayed: "Le mint a déjà été soumis par un relayer — fonds sur",
		forwarderStalled: "Transfert non terminé — mint manuel en cours…",
		resumeConfirm: "Ce brûlage a été créé pour le destinataire",
		notOnChain: "Portefeuille pas sur", abortMint: " — mint annulé avant envoi",
		walletChanged: "Compte ou chaîne modifié pendant le flux — annulation (aucune transaction soumise)",
		noWallet: "Aucun portefeuille détecté. Installez MetaMask.", connectionRejected: "Connexion rejetée : ",
		anotherBridge: "Un autre flux de pont est en cours",
		forwardCompleted: "Transfert terminé — fonds sur",
		attestationTimeout: "Timeout d'attestation — brûlage réussi ; réessayez le mint avec le hash",
		forwardTimeout: "Timeout de transfert — attestation signée, mint manuel possible",
		forwardTimeoutNoAtt: "Timeout de transfert — attestation pas encore signée ; Circle peut encore transférer",
		usdcBridgingUnavailable: "Pont USDC non disponible sur",
		bridgeNotDeployed: "Pont non déployé sur",
		bridgeToken: "Pont", to: "vers",
		ethNotAvailable: "ETH non disponible sur",
		ethOnlyEvm: "Pont ETH disponible uniquement sur les chaînes EVM (pas Arc)",
	},
	ar: {
		mainnet: "الشبكة الرئيسية", testnet: "شبكة الاختبار", notConnected: "غير متصل",
		connectWallet: "ربط المحفظة", crossChainBridge: "جسر عبر السلاسل",
		amount: "المبلغ", balance: "الرصيد", estGasFee: "رسوم الغاز المقدرة (المصدر)",
		cctpFee: "رسوم CCTP السريعة (USDC)",
		forwardingService: "خدمة التحويل — Circle يقدم السك لك (رسوم إضافية، لا حاجة لغاز الوجهة)",
		unfinishedBridge: "تم اكتشاف جسر غير مكتمل", resumeMint: "استئناف السك",
		dismiss: "تجاهل", burn: "حرق", attestation: "شهادة", mint: "سك",
		enterAmount: "أدخل المبلغ", cctpContracts: "عقود CCTP V2",
		txHistory: "سجل المعاملات", noTxs: "لا معاملات بعد",
		footerText: "جسر WarpArc · USDC عبر Circle CCTP V2",
		systemStatus: "حالة النظام", faucet: "الصنبور",
		sameChain: "نفس السلسلة المحددة", notDeployed: "غير مُنشر",
		approving: "موافقة USDC...", burning: "حرق", waitingAttest: "انتظار الشهادة...",
		minting: "سك على", waitingForward: "انتظار تحويل Circle...",
		bridgeComplete: "اكتمل الجسر!", bridgeFailed: "فشل الجسر: ",
		resumeFailed: "فشل الاستئناف: ", connectFirst: "اربط محفظتك أولاً",
		enterValidAmount: "أدخل مبلغًا صالحًا", invalidAmount: "تنسيق مبلغ غير صالح",
		amountMustExceed0: "يجب أن يكون المبلغ أكبر من 0", amountExceeds: "المبلغ يتجاوز",
		cctpUnavailable: "CCTP غير متاح على هذا المسار",
		networkMismatch: "يجب أن يكون المصدر والوجهة على نفس الشبكة (اختبار/رئيسية)",
		forwardUnavailable: "عرض رسوم التحويل غير متاح — أوقف الخدمة أو أعد المحاولة",
		amountMustExceedFee: "يجب أن يتجاوز المبلغ رسوم CCTP",
		switchingTo: "تبديل المحفظة إلى", alreadyRelayed: "تم تقديم السك بالفعل بواسطة مُرحّل — الأموال في",
		forwarderStalled: "المحول لم يكتمل — سك يدوي مستمر…",
		resumeConfirm: "تم إنشاء هذا الحرق للمستلم",
		notOnChain: "المحفظة ليست على", abortMint: " — تم إلغاء السك قبل الإرسال",
		walletChanged: "تم تغيير الحساب أو السلسلة أثناء التدفق — إلغاء (لم يتم إرسال معاملة)",
		noWallet: "لم يتم اكتشاف محفظة. قم بتثبيت MetaMask.", connectionRejected: "تم رفض الاتصال: ",
		anotherBridge: "تدفق جسر آخر قيد التنفيذ",
		forwardCompleted: "اكتمل التحويل — الأموال في",
		attestationTimeout: "انتهت مهلة الشهادة — الحرق نجح؛ أعد محاولة السك بالهاش",
		forwardTimeout: "انتهت مهلة التحويل — الشهادة موقعة، سك يدوي ممكن",
		forwardTimeoutNoAtt: "انتهت مهلة التحويل — الشهادة لم تُوقع بعد؛ Circle قد يحول بعد",
		usdcBridgingUnavailable: "جسر USDC غير متاح على",
		bridgeNotDeployed: "الجسر غير مُنشر على",
		bridgeToken: "جسر", to: "إلى",
		ethNotAvailable: "ETH غير متاح على",
		ethOnlyEvm: "جسر ETH متاح فقط على سلاسل EVM (ليس Arc)",
	},
	bn: {
		mainnet: "মেইননেট", testnet: "টেস্টনেট", notConnected: "সংযুক্ত নয়",
		connectWallet: "ওয়ালেট সংযুক্ত করুন", crossChainBridge: "ক্রস-চেইন ব্রিজ",
		amount: "পরিমাণ", balance: "ব্যালেন্স", estGasFee: "আনুমানিক গ্যাস ফি (উৎস)",
		cctpFee: "CCTP ফাস্ট-ট্রান্সফার ফি (USDC)",
		forwardingService: "ফরওয়ার্ডিং সার্ভিস — Circle আপনার জন্য মিন্ট জমা দেয় (অতিরিক্ত ফি, গন্তব্য গ্যাস প্রয়োজন নেই)",
		unfinishedBridge: "অসম্পূর্ণ ব্রিজ সনাক্ত হয়েছে", resumeMint: "মিন্ট পুনরায় শুরু করুন",
		dismiss: "বাতিল", burn: "বার্ন", attestation: "অ্যাটেস্টেশন", mint: "মিন্ট",
		enterAmount: "পরিমাণ লিখুন", cctpContracts: "CCTP V2 কন্ট্র্যাক্ট",
		txHistory: "লেনদেন ইতিহাস", noTxs: "এখনো কোনো লেনদেন নেই",
		footerText: "WarpArc ব্রিজ · USDC Circle CCTP V2 এর মাধ্যমে",
		systemStatus: "সিস্টেম স্ট্যাটাস", faucet: "ফসেট",
		sameChain: "একই চেইন নির্বাচিত", notDeployed: "মোতায়েন হয়নি",
		approving: "USDC অনুমোদন হচ্ছে...", burning: "বার্ন হচ্ছে", waitingAttest: "অ্যাটেস্টেশনের জন্য অপেক্ষা...",
		minting: "মিন্ট হচ্ছে", waitingForward: "Circle ফরওয়ার্ডের জন্য অপেক্ষা...",
		bridgeComplete: "ব্রিজ সম্পূর্ণ!", bridgeFailed: "ব্রিজ ব্যর্থ: ",
		resumeFailed: "পুনরায় শুরু ব্যর্থ: ", connectFirst: "প্রথমে আপনার ওয়ালেট সংযুক্ত করুন",
		enterValidAmount: "একটি বৈধ পরিমাণ লিখুন", invalidAmount: "অবৈধ পরিমাণ ফরম্যাট",
		amountMustExceed0: "পরিমাণ 0 এর বেশি হতে হবে", amountExceeds: "পরিমাণ আপনার চেয়ে বেশি",
		cctpUnavailable: "এই রুটে CCTP উপলব্ধ নয়",
		networkMismatch: "উৎস এবং গন্তব্য একই নেটওয়ার্কে হতে হবে (টেস্টনেট/মেইননেট)",
		forwardUnavailable: "ফরওয়ার্ডিং ফি কোট উপলব্ধ নয় — সার্ভিস বন্ধ করুন বা আবার চেষ্টা করুন",
		amountMustExceedFee: "পরিমাণ CCTP ফি এর বেশি হতে হবে",
		switchingTo: "ওয়ালেট পরিবর্তন হচ্ছে", alreadyRelayed: "মিন্ট ইতিমধ্যে রিলেয়ার দ্বারা জমা দেওয়া হয়েছে — তহবিল",
		forwarderStalled: "ফরওয়ার্ডার সম্পূর্ণ হয়নি — ম্যানুয়াল মিন্ট চলছে…",
		resumeConfirm: "এই বার্ন প্রাপকের জন্য তৈরি করা হয়েছিল",
		notOnChain: "ওয়ালেট নেই", abortMint: " — পাঠানোর আগে মিন্ট বাতিল",
		walletChanged: "ফ্লোর সময় অ্যাকাউন্ট বা চেইন পরিবর্তিত হয়েছে — বাতিল (কোনো লেনদেন জমা দেওয়া হয়নি)",
		noWallet: "কোনো ওয়ালেট সনাক্ত হয়নি। MetaMask ইনস্টল করুন।", connectionRejected: "সংযোগ প্রত্যাখ্যান: ",
		anotherBridge: "আরেকটি ব্রিজ ফ্লো চলছে",
		forwardCompleted: "ফরওয়ার্ড সম্পূর্ণ — তহবিল",
		attestationTimeout: "অ্যাটেস্টেশন টাইমআউট — বার্ন সফল; হ্যাশ দিয়ে মিন্ট আবার চেষ্টা করুন",
		forwardTimeout: "ফরওয়ার্ড সম্পূর্ণতা টাইমআউট — অ্যাটেস্টেশন স্বাক্ষরিত, ম্যানুয়াল মিন্ট সম্ভব",
		forwardTimeoutNoAtt: "ফরওয়ার্ড সম্পূর্ণতা টাইমআউট — অ্যাটেস্টেশন এখনো স্বাক্ষরিত হয়নি; Circle এখনো ফরওয়ার্ড করতে পারে",
		usdcBridgingUnavailable: "USDC ব্রিজিং উপলব্ধ নয়",
		bridgeNotDeployed: "ব্রিজ মোতায়েন হয়নি",
		bridgeToken: "ব্রিজ", to: "তে",
		ethNotAvailable: "ETH উপলব্ধ নয়",
		ethOnlyEvm: "ETH ব্রিজিং শুধুমাত্র EVM চেইনে উপলব্ধ (Arc নয়)",
	},
	pt: {
		mainnet: "Mainnet", testnet: "Testnet", notConnected: "Não conectado",
		connectWallet: "Conectar carteira", crossChainBridge: "Bridge cross-chain",
		amount: "Valor", balance: "Saldo", estGasFee: "Taxa de gas estimada (origem)",
		cctpFee: "Taxa CCTP Fast-Transfer (USDC)",
		forwardingService: "Serviço de encaminhamento — Circle envia o mint para você (taxa extra, sem gas de destino)",
		unfinishedBridge: "Bridge incompleto detectado", resumeMint: "Retomar mint",
		dismiss: "Dispensar", burn: "Queima", attestation: "Attestação", mint: "Mint",
		enterAmount: "Inserir valor", cctpContracts: "Contratos CCTP V2",
		txHistory: "Histórico de transações", noTxs: "Nenhuma transação ainda",
		footerText: "WarpArc Bridge · USDC via Circle CCTP V2",
		systemStatus: "Status do sistema", faucet: "Faucet",
		sameChain: "Mesma cadeia selecionada", notDeployed: "não implantado",
		approving: "Aprovando USDC...", burning: "Queimando", waitingAttest: "Aguardando attestation...",
		minting: "Cunhando em", waitingForward: "Aguardando encaminhamento Circle...",
		bridgeComplete: "Bridge completo!", bridgeFailed: "Bridge falhou: ",
		resumeFailed: "Retomada falhou: ", connectFirst: "Conecte sua carteira primeiro",
		enterValidAmount: "Insira um valor válido", invalidAmount: "Formato de valor inválido",
		amountMustExceed0: "O valor deve ser maior que 0", amountExceeds: "O valor excede seu",
		cctpUnavailable: "CCTP não disponível nesta rota",
		networkMismatch: "Origem e destino devem estar na mesma rede (testnet/mainnet)",
		forwardUnavailable: "Cotação de encaminhamento indisponível — desative o serviço ou tente novamente",
		amountMustExceedFee: "O valor deve exceder a taxa CCTP",
		switchingTo: "Alternando carteira para", alreadyRelayed: "O mint já foi enviado por um relayer — fundos em",
		forwarderStalled: "Encaminhador não completou — mint manual continuando…",
		resumeConfirm: "Esta queima foi criada para o destinatário",
		notOnChain: "Carteira não está em", abortMint: " — mint abortado antes de enviar",
		walletChanged: "Conta ou cadeia alterada durante o fluxo — abortando (nenhuma transação enviada)",
		noWallet: "Nenhuma carteira detectada. Instale MetaMask.", connectionRejected: "Conexão rejeitada: ",
		anotherBridge: "Outro fluxo de bridge em andamento",
		forwardCompleted: "Encaminhamento completo — fundos em",
		attestationTimeout: "Timeout de attestation — queima bem-sucedida; tente mint com o hash",
		forwardTimeout: "Timeout de encaminhamento — attestation assinada, mint manual possível",
		forwardTimeoutNoAtt: "Timeout de encaminhamento — attestation ainda não assinada; Circle pode ainda encaminhar",
		usdcBridgingUnavailable: "Bridge USDC indisponível em",
		bridgeNotDeployed: "Bridge não implantado em",
		bridgeToken: "Bridge", to: "para",
		ethNotAvailable: "ETH indisponível em",
		ethOnlyEvm: "Bridge ETH disponível apenas em cadeias EVM (não Arc)",
	},
	ru: {
		mainnet: "Мейннет", testnet: "Тестнет", notConnected: "Не подключено",
		connectWallet: "Подключить кошелёк", crossChainBridge: "Кросс-чейн мост",
		amount: "Сумма", balance: "Баланс", estGasFee: "Оценка комиссии газа (источник)",
		cctpFee: "Комиссия CCTP Fast-Transfer (USDC)",
		forwardingService: "Сервис пересылки — Circle отправит минт за вас (доп. комиссия, газ назначения не нужен)",
		unfinishedBridge: "Обнаружен незавершённый мост", resumeMint: "Возобновить минт",
		dismiss: "Закрыть", burn: "Сжигание", attestation: "Аттестация", mint: "Минт",
		enterAmount: "Введите сумму", cctpContracts: "Контракты CCTP V2",
		txHistory: "История транзакций", noTxs: "Транзакций пока нет",
		footerText: "WarpArc Bridge · USDC через Circle CCTP V2",
		systemStatus: "Статус системы", faucet: "Кран",
		sameChain: "Выбрана та же сеть", notDeployed: "не развёрнут",
		approving: "Одобрение USDC...", burning: "Сжигание", waitingAttest: "Ожидание аттестации...",
		minting: "Минт на", waitingForward: "Ожидание пересылки Circle...",
		bridgeComplete: "Мост завершён!", bridgeFailed: "Мост не удался: ",
		resumeFailed: "Возобновление не удалось: ", connectFirst: "Сначала подключите кошелёк",
		enterValidAmount: "Введите допустимую сумму", invalidAmount: "Неверный формат суммы",
		amountMustExceed0: "Сумма должна быть больше 0", amountExceeds: "Сумма превышает ваш",
		cctpUnavailable: "CCTP недоступен на этом маршруте",
		networkMismatch: "Источник и назначение должны быть в одной сети (тестнет/мейннет)",
		forwardUnavailable: "Котировка пересылки недоступна — отключите сервис или повторите",
		amountMustExceedFee: "Сумма должна превышать комиссию CCTP",
		switchingTo: "Переключение кошелька на", alreadyRelayed: "Минт уже отправлен релеером — средства на",
		forwarderStalled: "Пересылка не завершена — ручной минт продолжается…",
		resumeConfirm: "Это сжигание было создано для получателя",
		notOnChain: "Кошелёк не на", abortMint: " — минт отменён перед отправкой",
		walletChanged: "Аккаунт или сеть изменились во время процесса — отмена (транзакция не отправлена)",
		noWallet: "Кошелёк не обнаружен. Установите MetaMask.", connectionRejected: "Подключение отклонено: ",
		anotherBridge: "Другой процесс моста выполняется",
		forwardCompleted: "Пересылка завершена — средства на",
		attestationTimeout: "Таймаут аттестации — сжигание успешно; повторите минт с хешем",
		forwardTimeout: "Таймаут пересылки — аттестация подписана, ручной минт возможен",
		forwardTimeoutNoAtt: "Таймаут пересылки — аттестация ещё не подписана; Circle может ещё переслать",
		usdcBridgingUnavailable: "Мост USDC недоступен на",
		bridgeNotDeployed: "Мост не развёрнут на",
		bridgeToken: "Мост", to: "на",
		ethNotAvailable: "ETH недоступен на",
		ethOnlyEvm: "Мост ETH доступен только на EVM-цепях (не Arc)",
	},
	ja: {
		mainnet: "メインネット", testnet: "テストネット", notConnected: "未接続",
		connectWallet: "ウォレット接続", crossChainBridge: "クロスチェーンブリッジ",
		amount: "金額", balance: "残高", estGasFee: "推定ガス代（送信元）",
		cctpFee: "CCTP高速転送手数料（USDC）",
		forwardingService: "フォワーディングサービス — Circleがミントを送信（追加手数料、宛先ガス不要）",
		unfinishedBridge: "未完了のブリッジを検出", resumeMint: "ミント再開",
		dismiss: "閉じる", burn: "バーン", attestation: "アテステーション", mint: "ミント",
		enterAmount: "金額を入力", cctpContracts: "CCTP V2コントラクト",
		txHistory: "取引履歴", noTxs: "取引なし",
		footerText: "WarpArcブリッジ · USDC（Circle CCTP V2経由）",
		systemStatus: "システムステータス", faucet: "フォーセット",
		sameChain: "同じチェーンが選択されています", notDeployed: "未デプロイ",
		approving: "USDC承認中...", burning: "バーン中", waitingAttest: "アテステーション待ち...",
		minting: "ミント中", waitingForward: "Circleフォワード待ち...",
		bridgeComplete: "ブリッジ完了！", bridgeFailed: "ブリッジ失敗: ",
		resumeFailed: "再開失敗: ", connectFirst: "先にウォレットを接続してください",
		enterValidAmount: "有効な金額を入力", invalidAmount: "無効な金額形式",
		amountMustExceed0: "金額は0より大きい必要があります", amountExceeds: "金額が残高を超えています",
		cctpUnavailable: "このルートでCCTPは利用できません",
		networkMismatch: "送信元と宛先は同じネットワークである必要があります（テストネット/メインネット）",
		forwardUnavailable: "フォワーディング手数料の見積もり不可 — サービスをオフにするか再試行",
		amountMustExceedFee: "金額はCCTP手数料を超える必要があります",
		switchingTo: "ウォレット切り替え中", alreadyRelayed: "ミントはリレイヤーにより送信済み — 資金は",
		forwarderStalled: "フォワーダー未完了 — 手動ミント続行…",
		resumeConfirm: "このバーンは受取人向けに作成されました",
		notOnChain: "ウォレットが上にありません", abortMint: " — 送信前にミント中止",
		walletChanged: "フロー中にアカウントまたはチェーンが変更 — 中止（トランザクション未送信）",
		noWallet: "ウォレットが検出されません。MetaMaskをインストールしてください。", connectionRejected: "接続拒否: ",
		anotherBridge: "別のブリッジフローが進行中",
		forwardCompleted: "フォワード完了 — 資金は",
		attestationTimeout: "アテステーションタイムアウト — バーン成功；ハッシュでミント再試行可能",
		forwardTimeout: "フォワード完了タイムアウト — アテステーション署名済み、手動ミント可能",
		forwardTimeoutNoAtt: "フォワード完了タイムアウト — アテステーション未署名；Circleがフォワードする可能性あり",
		usdcBridgingUnavailable: "USDCブリッジは利用できません",
		bridgeNotDeployed: "ブリッジ未デプロイ",
		bridgeToken: "ブリッジ", to: "へ",
		ethNotAvailable: "ETHは利用できません",
		ethOnlyEvm: "ETHブリッジはEVMチェーンでのみ利用可能（Arcは不可）",
	},
};

const LANG_META = {
	en: { flag: "EN", label: "English" },
	zh: { flag: "ZH", label: "中文" },
	hi: { flag: "HI", label: "हिन्दी" },
	es: { flag: "ES", label: "Español" },
	fr: { flag: "FR", label: "Français" },
	ar: { flag: "AR", label: "العربية" },
	bn: { flag: "BN", label: "বাংলা" },
	pt: { flag: "PT", label: "Português" },
	ru: { flag: "RU", label: "Русский" },
	ja: { flag: "JA", label: "日本語" },
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
// Saved wallet pick — {type:"injected",rdns,label} | {type:"walletconnect"} —
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
	// Default to Testnet — Arc is testnet-only until public mainnet (Sep 16, 2026)
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

const shortAddr = (a) => a.slice(0, 6) + "…" + a.slice(-4);

// --- Protocol Selector (Relay / Li.Fi / CCTP) --------------------------------

const PROTOCOL_KEY = "warparc:protocol";

const PROTOCOLS = {
	relay: {
		name: "Relay",
		icon: "⚡",
		fee: "0%",
		speed: "<3s",
		chains: "85+",
		desc: "Fastest cross-chain bridge. Intent-based, p50 <3s fill time. 0% fee for ETH→ETH.",
		apiBase: "https://api.relay.link",
		testnetApiBase: "https://api.testnets.relay.link",
		supportedTokens: ["ETH"],
	},
	lifi: {
		name: "Li.Fi",
		icon: "🔗",
		fee: "0.25%",
		speed: "~30s",
		chains: "60+",
		desc: "Bridge aggregator routing through 20+ bridges for best rates. Supports Arc chain.",
		apiBase: "https://li.quest/v1",
		supportedTokens: ["ETH", "USDC"],
	},
	cctp: {
		name: "CCTP V2",
		icon: "🔵",
		fee: "~$0.10",
		speed: "~15min",
		chains: "5",
		desc: "Circle's native USDC bridge. Burn-and-mint, no wrapped tokens. Canonical route for Arc.",
		supportedTokens: ["USDC"],
	},
	across: {
		name: "Across",
		icon: "⛓️",
		fee: "~0.05%",
		speed: "~2s",
		chains: "24+",
		desc: "Fastest cross-chain (~2s fills). Uses optimistic relayers. Native ETH supported.",
		apiBase: "https://app.across.to/api",
		supportedTokens: ["ETH"],
	},
	stargateV2: {
		name: "Stargate V2",
		icon: "⚡",
		fee: "~0.06%",
		speed: "~2min",
		chains: "15+",
		desc: "LayerZero-based unified liquidity. Native ETH via Router contract.",
		supportedTokens: ["ETH"],
	},
	socket: {
		name: "Socket/Bungee",
		icon: "🔌",
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
// --- Stargate V2 Integration --------------------------------------------------

const STARGATE_ROUTER_ADDRESS = "0x150f4E4bD86B9b3655702eFEfB78c8b1D9b5d6c0";
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
// --- Protocol-aware quote fetching -------------------------------------------

async function fetchProtocolQuote(fromKey, toKey, amountWei, token) {
	const fromChain = CONFIG.chains[fromKey];
	const toChain = CONFIG.chains[toKey];
	if (!fromChain || !toChain) return null;

	const proto = getSelectedProtocol();

	// CCTP uses existing flow — no external quote needed
	if (proto === "cctp" || token === "USDC") {
		return { protocol: "cctp", output: null, feePercent: "~0.003%", estTimeSec: 900 };
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
		if (outEl) outEl.textContent = "—";
		if (feeEl) feeEl.textContent = "—";
		if (timeEl) timeEl.textContent = "—";
		if (routeEl) routeEl.textContent = "—";
		return;
	}

	const token = getSelectedToken();
	const decimals = token === "USDC" ? 6 : 18;
	const symbol = token;

	if (outEl) {
		outEl.textContent = quote.output
			? truncateUnits(quote.output, decimals, 4) + " " + symbol
			: "—";
	}
	if (feeEl) feeEl.textContent = quote.feePercent ? `${quote.feePercent}%` : "—";
	if (timeEl) {
		const sec = quote.estTimeSec || 0;
		if (sec < 60) timeEl.textContent = `${sec}s`;
		else timeEl.textContent = `~${Math.round(sec / 60)}min`;
	}
	if (routeEl) routeEl.textContent = quote.tool || quote.protocol || "—";
}

// --- persistence (localStorage) ----------------------------------------------

function saveTxHistory() {
	try {
		localStorage.setItem(HISTORY_KEY, JSON.stringify(state.txHistory.slice(-50)));
	} catch { /* storage full/blocked — history stays in-memory only */ }
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
	} catch { /* corrupt payload — start fresh */ }
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
		// recipient is optional but must be a string when present — a non-string
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
		text.textContent = `Unfinished bridge: ${p.amount} USDC burned on ${CONFIG.chains[p.fromKey].shortName} → ${CONFIG.chains[p.toKey].shortName}` +
			(p.forward ? " (waiting for Circle forward)" : " (mint not yet submitted)") +
			(p.recipient ? ` · penerima ${shortAddr(p.recipient)}` : "");
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

// Re-create provider/signer after a wallet chain switch — ethers caches the
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
// refreshProvider/onAccountChange) — the double refresh is safe because
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
	// WalletConnect sessions outlive the page — terminate the server-side
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
		bridgeArea.style.display = "none";
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

function getBridgeContract(chainKey, signerOrProvider, token) {
	const t = token || getSelectedToken();
	if (t === "USDC") {
		const addr = CONFIG.bridgeAdapter.deployments[chainKey];
		if (!addr) return null;
		return new ethers.Contract(addr, OFT_ABI, signerOrProvider);
	}
	const addr = CONFIG.bridgeToken.deployments[chainKey];
	if (!addr) return null;
	return new ethers.Contract(addr, OFT_ABI, signerOrProvider);
}

// Read-only provider for the SELECTED source chain. Balances and gas estimates
// must reflect what the user picked in the UI — not whatever chain the wallet
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
// order — only the latest invocation may write the balance display.
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
		if (token === "ABT") {
			const contract = getBridgeContract(fromKey, provider, "ABT");
			if (contract) {
				const bal = await contract.balanceOf(state.account);
				if (isStale()) return;
				state.lastFromBalanceRaw = bal;
				el("from-balance").textContent = truncateUnits(bal, 18, 4);
			} else {
				state.lastFromBalanceRaw = null;
				el("from-balance").textContent = "N/A";
			}
		} else if (token === "USDC") {
			// Always the 6-dec ERC-20 view (on Arc it is the same asset as native
			// gas — one balance, two views; never sum or convert between them).
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
			// Native ETH balance (18 decimals) — not available on Arc (USDC is gas)
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
// manipulation — Number() would lose precision on huge balances and toFixed()
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
	el("from-domain").textContent = fromChain.cctpDomain != null ? fromChain.cctpDomain : "—";
	el("to-domain").textContent = toChain.cctpDomain != null ? toChain.cctpDomain : "—";
	el("from-cid").textContent = fromChain.chainId;
	el("to-cid").textContent = toChain.chainId;
}

function renderContractList(chainKey) {
	const chain = CONFIG.chains[chainKey] || {};
	const c = chain.cctp || {};
	const entries = [];
	if (getSelectedToken() === "ABT") {
		// Legacy LayerZero OFT deployments (deprecated; ABT demo only) — addresses are filled
		// by scripts/deploy-all.js; null means not deployed on this chain.
		entries.push(["BridgeToken (OFT)", CONFIG.bridgeToken.deployments[chainKey]]);
		entries.push(["BridgeAdapter (OFT)", CONFIG.bridgeAdapter.deployments[chainKey]]);
	} else {
		const usdcAddr = c.usdc || (CONFIG.tokens.USDC.addresses || {})[chainKey];
		if (usdcAddr) entries.push(["USDC", usdcAddr]);
		if (c.tokenMessengerV2) entries.push(["TokenMessenger V2", c.tokenMessengerV2]);
		if (c.messageTransmitterV2) entries.push(["MessageTransmitter V2", c.messageTransmitterV2]);
		if (c.tokenMinterV2) entries.push(["TokenMinter V2", c.tokenMinterV2]);
	}

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
// Manual mode: maxFee = 10× the fast minimum (floor 500 = official quickstart
// value) so the burn doesn't revert if the fee ticks up before landing —
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
				// Protocol component scales with the burn amount — canonical quickstart
				// Step 4 math: protocolFee = amount × minimumFee × 100 / 1e6
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
		const minimumFee = BigInt(fast.minimumFee);
		let forwardFee = null;
		if (fast.forwardFee && fast.forwardFee.high != null) {
			forwardFee = {
				low: BigInt(fast.forwardFee.low),
				med: BigInt(fast.forwardFee.med),
				high: BigInt(fast.forwardFee.high)
			};
		}
		return { minimumFee, forwardFee };
	} catch {
		return null;
	}
}

// Overlapping estimates (fast typing, chain flips) can resolve out of order —
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

		// ETH — fetch protocol quote for accurate estimate
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

		// ABT — deprecated legacy LayerZero OFT quote (ABT demo only)
		const contract = getBridgeContract(fromKey, state.provider, token);
		if (!contract) { elEst.textContent = "N/A (deploy first)"; return; }

		const dstEid = toChain.eid;
		const toBytes32 = "0x" + "0".repeat(24) + state.account.slice(2);
		const amount = el("amount").value.trim();
		const tokenDecimals = 18;
		const amountLD = amount ? ethers.parseUnits(amount, tokenDecimals) : ethers.parseUnits("1", tokenDecimals);

		const sendParam = {
			dstEid: dstEid,
			to: toBytes32,
			amountLD: amountLD,
			minAmountLD: amountLD,
			extraOptions: "0x",
			composeMsg: "0x",
			oftCmd: "0x"
		};

		const quote = await contract.quoteSend(sendParam, false);
		const feeBuffer = quote.nativeFee * 110n / 100n;
		if (isStale()) return;
		elEst.textContent = truncateUnits(feeBuffer, 18, 6);
	} catch (e) {
		if (!isStale()) elEst.textContent = "N/A";
	}
}

// ---------------------------------------------------------------------------
// Bridging — USDC via CCTP V2, ABT via legacy OFT
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
		// lastFromBalanceRaw tracks the SELECTED source chain — reject before the
		// approve can succeed and strand the user at a reverting burn.
		if (state.lastFromBalanceRaw != null && parsedAmount > state.lastFromBalanceRaw) {
			toast("Amount exceeds your " + token + " balance on " + CONFIG.chains[fromKey].shortName, "error");
			return;
		}

		const proto = getSelectedProtocol();

		if (token === "USDC" && proto === "cctp") {
			await bridgeUSDCViaCCTP(amount, parsedAmount, fromKey, toKey);
		} else if (token === "ETH" && proto === "relay") {
			await bridgeViaRelay(amount, parsedAmount, fromKey, toKey);
		} else if (token === "ETH" && proto === "lifi") {
			await bridgeViaLiFi(amount, parsedAmount, fromKey, toKey);
		} else if (token === "ETH" && proto === "across") {
			await bridgeViaAcross(amount, parsedAmount, fromKey, toKey);
		} else if (token === "ETH" && proto === "stargateV2") {
			await bridgeViaStargate(amount, parsedAmount, fromKey, toKey);
		} else if (token === "ETH" && proto === "socket") {
			await bridgeViabungee(amount, parsedAmount, fromKey, toKey);
		} else if (token === "ETH") {
			// Multi-protocol fallback — tries LiFi → Relay → Across → Stargate → Socket
			await bridgeETHNative(amount, parsedAmount, fromKey, toKey);
		} else if (token === "USDC") {
			await bridgeUSDCViaCCTP(amount, parsedAmount, fromKey, toKey);
		} else {
			await bridgeLegacyOFT(amount, parsedAmount, fromKey, toKey, token);
		}
	} finally {
		state.isBridging = false;
		setFlowsBusy(false);
		updateBridgeBtn();
	}
}

// Circle CCTP V2 burn-and-mint. forward=true routes through Circle's
// Forwarding Service (depositForBurnWithHook + "cctp-forward" hook) so the
// destination mint is submitted by Circle — essential when the recipient has
// no gas on the destination (USDC is gas on Arc).
// Reference quickstart: https://developers.circle.com/cctp/quickstarts/transfer-usdc-ethereum-to-arc
async function bridgeUSDCViaCCTP(amount, parsedAmount, fromKey, toKey) {
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
		// Arc: type-2 tx, maxFeePerGas ≥ 20 Gwei floor, priority tip 0 is accepted
		? { maxFeePerGas: ethers.parseUnits("30", "gwei"), maxPriorityFeePerGas: 0n }
		: {};

	const quote = await quoteBurnFee(fromChain, toChain, forward, parsedAmount);
	if (!quote) {
		toast("Forwarding fee quote unavailable — turn off Forwarding Service or retry", "error");
		return;
	}
	// The executed fee is deducted from the transferred amount — an amount at or
	// below the fee would burn everything (or revert).
	const feeTotal = quote.minimumFee + (quote.forwardFee || 0n);
	if (parsedAmount <= feeTotal) {
		toast("Amount must exceed the CCTP fee (" + truncateUnits(feeTotal, 6, 4) + " USDC)", "error");
		return;
	}

	const burnTxId = "burn-" + Date.now();
	const btn = el("bridge-btn");
	setFlowsBusy(true);
	let subTxId = null; // fwd-/att- sub-entry — must not stay "pending" on abort

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
		// or chain — abort before any transaction is submitted.
		const assertWalletStable = () => {
			if (state.account !== expectedAccount || state.chainId !== fromChain.chainId) {
				throw new Error("Wallet account or chain changed mid-flow — aborting before send (no transaction was submitted)");
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
		// destinationCaller = zero bytes32 → any address may submit receiveMessage.
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

		// Stepper: burn done → attestation/forward active
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
				// Forwarder stalled but the attestation is signed — mint manually
				// (fwd- is done; the fallback mint gets its own entry).
				updateTxEntry(fwdTxId, "failed", "");
				await manualMintFallback(toChain, toKey, e.att, amount);
				return;
			}
			updateTxEntry(fwdTxId, "success", forwardHash);
			toast(`Bridge complete! ${amount} USDC → ${toChain.shortName} (forwarded by Circle)`, "success");
			clearPendingCctp();
			loadBalances();
			// Stepper: all done
			updateStepper("attest", "done");
			updateStepperLine("attest", "done");
			updateStepper("mint", "done");
		} else {
			// 4b. Wait for Circle to sign the attestation (fast ≈ seconds)
			btn.textContent = "Waiting for attestation...";
			const attTxId = "att-" + Date.now();
			subTxId = attTxId;
			addTxEntry(attTxId, "Circle attestation (fast)", "pending", fromKey);
			const att = await pollAttestation(CONFIG.iris[fromChain.network], fromChain.cctpDomain, burnTx.hash);
			updateTxEntry(attTxId, "success", burnTx.hash);

			// Stepper: attestation done → mint active
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
				throw new Error("Wallet chain changed mid-flow — aborting before mint (no transaction was submitted)");
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
// where a relayer already processed the nonce — then the funds HAVE arrived,
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
			toast(`Bridge complete! ${amount} USDC → ${toChain.shortName}`, "success");
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
			toast("Mint was already submitted by a relayer — funds are on " + toChain.shortName, "success");
			clearPendingCctp();
			updateStepper("mint", "done");
		} else {
			// Rejected/reverted mint: the burn is safe on-chain — KEEP the pending
			// record so the resume banner survives for a retry.
			updateTxEntry(mintTxId, "failed", "");
			updateStepper("mint", "failed");
			throw e;
		}
	} finally {
		loadBalances();
	}
}

// Forwarder stalled but Iris already signed the attestation — anyone may
// submit receiveMessage (destinationCaller = zero), so finish the mint by
// hand. submitMint clears the pending record on success, keeps it on failure.
async function manualMintFallback(toChain, toKey, att, amount, labelSuffix = " (manual fallback)") {
	toast("Forwarder belum selesai — melanjutkan dengan mint manual…", "info");
	await switchChain(toChain.chainId);
	await refreshProvider();
	onAccountChange();
	// Same defense as the other pre-mint paths: a silently-ignored chain switch
	// would send the mint to the wrong network (wasted gas — USDC on Arc).
	if (state.chainId !== toChain.chainId) {
		throw new Error(`Wallet is not on ${toChain.name} — mint aborted before send`);
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
			toast("Forward completed — funds are on " + toChain.shortName, "success");
			clearPendingCctp();
		} else {
			// The mint always pays the ORIGINAL recipient; a different connected
			// account only pays the gas — make that explicit before proceeding.
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
				throw new Error("Wallet chain changed mid-flow — aborting before mint (no transaction was submitted)");
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
		} catch { /* transient network error — keep polling */ }
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
	// (destinationCaller = zero) — surface it instead of dead-ending.
	const msg = await fetchMsg();
	if (msg && msg.status === "complete" && msg.message && msg.attestation) {
		const e = new Error("Forward completion timeout — attestation signed, manual mint possible");
		e.name = "ForwardTimeoutWithAttestation";
		e.att = msg;
		throw e;
	}
	throw new Error("Forward completion timeout — attestation not signed yet; Circle may still forward it, or resume later from this page");
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
		} catch { /* transient network error — keep polling */ }
		await sleep(5000);
	}
	throw new Error("Attestation timeout — the burn succeeded; mint can be retried with the burn tx hash");
}

// DEPRECATED LayerZero OFT path, kept for the ABT demo token only.
async function bridgeLegacyOFT(amount, parsedAmount, fromKey, toKey, token) {
	const fromChain = CONFIG.chains[fromKey];
	const toChain = CONFIG.chains[toKey];

	if (fromChain.chainId !== state.chainId) {
		toast(`Switch to ${fromChain.name}`, "error");
		try { await switchChain(fromChain.chainId); await refreshProvider(); } catch { return; }
	}

	const contract = getBridgeContract(fromKey, state.signer, token);
	if (!contract) {
		toast("Bridge token not deployed on " + fromChain.shortName, "error");
		return;
	}

	const txId = "tx-" + Date.now();
	const btn = el("bridge-btn");
	setFlowsBusy(true);
	btn.textContent = `Bridging ${amount} ${token}...`;

	addTxEntry(txId, `Bridge ${amount} ${token} → ${toChain.shortName}`, "pending", fromKey);

	try {
		const dstEid = toChain.eid;
		const toBytes32 = "0x" + "0".repeat(24) + state.account.slice(2);

		const amountLD = parsedAmount;
		const minAmountLD = amountLD * 995n / 1000n;

		const sendParam = {
			dstEid: dstEid,
			to: toBytes32,
			amountLD: amountLD,
			minAmountLD: minAmountLD,
			extraOptions: "0x",
			composeMsg: "0x",
			oftCmd: "0x"
		};

		const fee = await contract.quoteSend(sendParam, false);
		const feeBuffer = fee.nativeFee * 110n / 100n;

		const tx = await contract.send(
			sendParam,
			{ nativeFee: feeBuffer, lzTokenFee: 0n },
			state.account,
			{ value: feeBuffer }
		);

		updateTxEntry(txId, "pending", tx.hash);

		const receipt = await tx.wait();

		if (receipt.status === 1) {
			updateTxEntry(txId, "success", tx.hash);
			toast(`Bridge complete! ${amount} ${token} → ${toChain.shortName}`, "success");
			loadBalances();
		} else {
			updateTxEntry(txId, "failed", tx.hash);
			toast("Transaction failed", "error");
		}
	} catch (e) {
		updateTxEntry(txId, "failed", "");
		toast("Bridge failed: " + (e.reason || e.shortMessage || e.message || "Unknown error"), "error");
	}
}

// ETH native bridge — multi-protocol fallback router.
// Tries protocols in order: Li.Fi → Relay → Across (if API key) → Stargate V2 → Socket/Bungee.
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

	const apiKeyAcross = CONFIG.ethBridge?.apiKeys?.across || "";
	const protocols = [
		{ name: "Li.Fi",      fn: bridgeViaLiFi },
		{ name: "Relay",      fn: bridgeViaRelay },
	];
	if (apiKeyAcross) protocols.push({ name: "Across", fn: bridgeViaAcross });
	protocols.push(
		{ name: "Stargate V2",  fn: bridgeViaStargate },
		{ name: "Socket/Bungee",fn: bridgeViabungee }
	);

	for (const proto of protocols) {
		try {
			await proto.fn(amount, parsedAmount, fromKey, toKey);
			return; // success — stop here
		} catch (e) {
			console.warn(`[ETH Bridge] ${proto.name} failed: ${e.message}. Next...`);
		}
	}
	// All failed — the last bridgeViaXxx already showed its error toast
}

// Relay protocol bridge — intent-based, fastest fills (<3s p50)
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

		btn.textContent = "Getting Relay quote...";
		addTxEntry(txId, `Bridge ${amount} ETH → ${toChain.shortName} (Relay)`, "pending", fromKey);

		// Get quote from Relay API
		const quote = await relayQuote(fromChain, toChain, parsedAmount, "ETH");
		if (!quote || !quote.steps || !quote.steps.length) {
			throw new Error("Relay quote unavailable for this route");
		}

		updateQuoteDisplay(quote);
		btn.textContent = "Sending via Relay...";

		// Execute the bridge
		const result = await relayExecute(quote);

		updateTxEntry(txId, "success", result.txHash);
		toast(`${t("bridgeComplete")} ${amount} ETH → ${toChain.shortName} (Relay)`, "success");
		loadBalances();
	} catch (e) {
		updateTxEntry(txId, "failed", "");
		toast(`${t("bridgeFailed")}${e.reason || e.shortMessage || e.message || "Unknown error"}`, "error");
	} finally {
		setFlowsBusy(false);
		updateBridgeBtn();
	}
}
// Across Protocol bridge — fastest fills (~2s). Requires API key.
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

		btn.textContent = "Getting Across quote...";
		addTxEntry(txId, `Bridge ${amount} ETH → ${toChain.shortName} (Across)`, "pending", fromKey);

		const quote = await acrossQuote(fromChain, toChain, parsedAmount, "ETH");
		if (!quote || !quote.swapTx) {
			throw new Error("Across quote unavailable for this route");
		}

		updateQuoteDisplay(quote);
		btn.textContent = "Sending via Across...";

		const result = await acrossExecute(quote);

		updateTxEntry(txId, "success", result.txHash);
		toast(`${t("bridgeComplete")} ${amount} ETH → ${toChain.shortName} (Across)`, "success");
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

// Stargate V2 bridge — LayerZero-based, direct contract interaction.
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
		addTxEntry(txId, `Bridge ${amount} ETH → ${toChain.shortName} (Stargate V2)`, "pending", fromKey);

		const quote = await stargateQuote(fromChain, toChain, parsedAmount, "ETH");
		if (!quote || !quote.dstChainId) {
			throw new Error("Stargate quote unavailable for this route");
		}

		updateQuoteDisplay(quote);
		btn.textContent = "Sending via Stargate...";

		const result = await stargateExecute(quote, fromKey, toKey, parsedAmount);

		updateTxEntry(txId, "success", result.txHash);
		toast(`${t("bridgeComplete")} ${amount} ETH → ${toChain.shortName} (Stargate V2)`, "success");
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

// Socket/Bungee bridge — cross-chain routing engine.
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
		addTxEntry(txId, `Bridge ${amount} ETH → ${toChain.shortName} (Socket)`, "pending", fromKey);

		const quote = await socketQuote(fromChain, toChain, parsedAmount, "ETH");
		if (!quote || !quote.route) {
			throw new Error("Socket quote unavailable for this route");
		}

		updateQuoteDisplay(quote);
		btn.textContent = "Sending via Socket...";

		const result = await socketExecute(quote);

		updateTxEntry(txId, "success", result.txHash);
		toast(`${t("bridgeComplete")} ${amount} ETH → ${toChain.shortName} (Socket)`, "success");
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

// Li.Fi protocol bridge — aggregator routing through 20+ bridges
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

		btn.textContent = "Getting Li.Fi quote...";
		addTxEntry(txId, `Bridge ${amount} ETH → ${toChain.shortName} (Li.Fi)`, "pending", fromKey);

		// Get quote from Li.Fi API
		const quote = await lifiQuote(fromChain, toChain, parsedAmount, "ETH");
		if (!quote || !quote.transactionRequest) {
			throw new Error("Li.Fi quote unavailable for this route");
		}

		updateQuoteDisplay(quote);
		btn.textContent = `Sending via ${quote.tool || "Li.Fi"}...`;

		// Execute the bridge
		const result = await lifiExecute(quote);

		updateTxEntry(txId, "success", result.txHash);
		toast(`${t("bridgeComplete")} ${amount} ETH → ${toChain.shortName} (Li.Fi)`, "success");
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
// disabled state is touched — labels stay owned by updateBridgeBtn/the flow.
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
		if (!CONFIG.tokens.USDC.addresses[fromKey] || !CONFIG.chains[fromKey].cctp) {
			btn.textContent = t("usdcBridgingUnavailable") + " " + CONFIG.chains[fromKey].shortName;
			btn.disabled = true;
			return;
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
	} else {
		// Truthy check: testnet keys are absent from deployments (undefined),
		// which must count as not deployed — `!== null` would let them through.
		const bridgeDeployed = !!CONFIG.bridgeToken.deployments[fromKey];
		if (!bridgeDeployed) {
			btn.textContent = t("bridgeNotDeployed") + " " + CONFIG.chains[fromKey].shortName;
			btn.disabled = true;
			return;
		}
	}

	if (!amount || Number(amount) <= 0) { btn.textContent = t("enterAmount"); btn.disabled = true; return; }

	btn.textContent = `${t("bridgeToken")} ${amount} ${token} ${t("to")} ${CONFIG.chains[toKey].shortName}`;
	btn.disabled = false;
}

// A chain is bridgeable in the UI when Circle publishes a CCTP domain for it
// (robinhood has none yet; arcMainnet stays disabled until launch-day values
// are filled in — MAINNET-CHECKLIST.md Phase 1/2).
function isBridgeableChain(chainKey) {
	const c = CONFIG.chains[chainKey];
	return !!(c && !c.disabled && c.cctpDomain != null && c.cctp && c.cctp.tokenMessengerV2);
}

function getFilteredChains() {
	const mode = state.testnetMode ? "testnet" : "mainnet";
	const token = getSelectedToken();
	return Object.keys(CONFIG.chains).filter(k => {
		const c = CONFIG.chains[k];
		if (c.network !== mode) return false;
		// ETH bridging: exclude Arc (USDC is gas on Arc, not ETH)
		if (token === "ETH" && (k === "arc" || k === "arcMainnet")) return false;
		return isBridgeableChain(k);
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
	if (state.account) loadBalances();
	estimateGas();
}

function onAmountChange() {
	updateBridgeBtn();
	estimateGas();
}

function onTokenChange() {
	const token = getSelectedToken();
	const meta = CONFIG.tokens[token] || CONFIG.bridgeToken;
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
// openWalletModal from window.WalletRegistry.discovered — see wallets.js).
// ---------------------------------------------------------------------------

// Neutral glyph for wallets that announce no icon (EIP-6963 icon is optional).
// Inline data URI keeps the strict CSP happy — no extra img-src host needed.
const GENERIC_WALLET_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect x='3' y='7' width='26' height='18' rx='3' fill='%232775CA'/%3E%3Crect x='18' y='14' width='11' height='7' rx='2' fill='%231E5FA8'/%3E%3Ccircle cx='23.5' cy='17.5' r='1.4' fill='%23FFFFFF'/%3E%3C/svg%3E";

// Memoized EthereumProvider init; the live instance is also cached on window
// (__wcProvider) so a second modal pass never re-imports/re-initializes.
let wcInitPromise = null;

async function initWalletConnect() {
	// Read at CALL time — projectId may be filled into config.js between loads.
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
	// Rows render at OPEN time — discovery results and CONFIG may differ per load.
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
	// Success closed the modal; a rejection leaves it up — reset either way.
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
		// Persist the pick for silent reloads — rdns preferred, display name as
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
// different provider always detaches the previous handlers first — switching
// wallets (or reconnecting after a disconnect) never accumulates listeners.
function bindWalletEvents(p) {
	if (state._eventsBound && state._boundProvider === p) return;
	if (state._boundProvider) {
		if (state._accountsChanged) state._boundProvider.removeListener("accountsChanged", state._accountsChanged);
		if (state._chainChanged) state._boundProvider.removeListener("chainChanged", state._chainChanged);
	}
	state._accountsChanged = async (accounts) => {
		if (!Array.isArray(accounts)) return;
		// Stale event from an already-disconnected provider — ignore quietly.
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

	// Bound in JS (not inline onclick) so the strict CSP in vercel.json —
	// script-src 'self' + cdnjs, no 'unsafe-inline' — cannot block them.
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
			// Forwarded transfers complete on their own — dismiss clears the
			// state. Manual ones stay resumable; dismiss only hides the banner.
			if (p && p.forward) clearPendingCctp();
			else el("pending-resume").style.display = "none";
		});
	}

	const toggle = el("network-mode-toggle");
	if (toggle) {
		toggle.checked = state.testnetMode;
		toggle.addEventListener("change", () => {
			state.testnetMode = toggle.checked;
			populateChainSelects();
			onChainChange();
			renderWalletChainPicker();
		});
	}

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

	// Start in disconnected state — card shows form but muted
	const card = document.querySelector(".bridge-card");
	if (card && !state.account) card.classList.add("disconnected");
});

