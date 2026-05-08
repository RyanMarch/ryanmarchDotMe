.PHONY: serve

serve:
	@echo "------------------------------------------------"
	@echo "🚀 RyanMarch.me Local Development Server"
	@echo "------------------------------------------------"
	@echo "Opening http://localhost:8000..."
	@open "http://localhost:8000"
	@python3 -m http.server 8000
