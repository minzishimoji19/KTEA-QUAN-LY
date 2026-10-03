import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
      <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-4">
        <AlertCircle className="w-6 h-6 text-amber-400" />
      </div>
      <h2 className="text-xl font-bold font-mono text-slate-100">404 // ROUTE_NOT_FOUND</h2>
      <p className="text-xs text-slate-400 mt-2 max-w-sm">
        The requested cockpit module or customer record path does not exist in this environment.
      </p>
      <Link to="/" className="mt-6">
        <Button size="sm" variant="primary" className="gap-1.5 text-xs">
          <ArrowLeft className="w-3.5 h-3.5" /> Return to Cockpit
        </Button>
      </Link>
    </div>
  );
};

export default NotFoundPage;
