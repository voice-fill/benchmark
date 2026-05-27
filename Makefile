# Run benchmark then start dashboard
run:
	npx tsx src/cli.ts run --providers openai-whisper
	@echo ""
	@echo "Starting dashboard at http://localhost:3001"
	npx tsx src/dashboard.ts

# Run benchmark with all available providers
benchmark:
	npx tsx src/cli.ts run

# Run benchmark with specific provider(s)
benchmark-openai:
	npx tsx src/cli.ts run --providers openai-whisper

# Start dashboard server
dashboard:
	npx tsx src/dashboard.ts

# List available providers
providers:
	npx tsx src/cli.ts providers

# Run tests
test:
	npm test

# Type check
typecheck:
	npm run typecheck
