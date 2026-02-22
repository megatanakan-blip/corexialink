import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
    children: ReactNode;
    componentName?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class DebugErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg m-4">
                    <div className="flex items-center gap-2 text-red-700 font-bold mb-2">
                        <AlertTriangle size={20} />
                        <h3>エラーが発生しました ({this.props.componentName || 'Unknown'})</h3>
                    </div>
                    <pre className="text-xs text-red-600 bg-red-100 p-2 rounded overflow-auto max-h-40">
                        {this.state.error?.message}
                    </pre>
                    <button
                        onClick={() => this.setState({ hasError: false })}
                        className="mt-2 text-xs bg-red-200 hover:bg-red-300 text-red-800 px-3 py-1 rounded font-bold"
                    >
                        再試行
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
