import React from 'react';
import { RefreshCw, AlertTriangle, ShoppingBag } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.removeItem('counter_sale_draft');
      localStorage.removeItem('local_counter_sales');
      localStorage.removeItem('local_counter_khata');
    } catch (e) {}
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center mb-4 shadow-sm">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2 font-poppins">
            Counter Sale System Ready
          </h2>
          <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
            Click below to load fresh Counter Sale POS interface.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-sm rounded-2xl shadow-md transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Reset & Open Counter Sale
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
