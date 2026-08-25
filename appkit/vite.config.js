import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
	plugins: [react()],
	build: {
		outDir: "dist",
		rollupOptions: {
			output: {
				manualChunks: {
					react: ["react", "react-dom"],
					circle: ["@circle-fin/app-kit", "@circle-fin/adapter-viem-v2"],
					wallets: ["viem", "wagmi"]
				}
			}
		}
	},
	server: {
		port: 5174
	}
});
