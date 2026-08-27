import React from "react";
import ReactDOM from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "./wagmi";
import App, { ErrorBoundary } from "./App";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")).render(
	<React.StrictMode>
		<ErrorBoundary>
			<WagmiProvider config={config}>
				<QueryClientProvider client={queryClient}>
					<App />
				</QueryClientProvider>
			</WagmiProvider>
		</ErrorBoundary>
	</React.StrictMode>
);
