import React from "react";

export default class ErrorBoundary extends React.Component {
	constructor(props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error) {
		return { hasError: true, error };
	}

	componentDidCatch(error, info) {
		console.error("ErrorBoundary caught:", error, info);
	}

	render() {
		if (this.state.hasError) {
			return (
				this.props.fallback || (
					<div className="min-h-[40vh] flex items-center justify-center text-center px-6">
						<div>
							<p className="font-editorial text-[24px] text-baume-charcoal/50 mb-3">
								Une erreur est survenue
							</p>
							<button
								onClick={() => this.setState({ hasError: false, error: null })}
								className="h-10 px-5 rounded-full bg-baume-burgundy text-baume-white text-[13px] font-semibold"
							>
								Réessayer
							</button>
						</div>
					</div>
				)
			);
		}
		return this.props.children;
	}
}
