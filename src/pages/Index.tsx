import * as React from "react";

const Index = () => {
  // Mantido como wrapper para não quebrar imports existentes.
  // O Dashboard real vive em src/pages/Dashboard.tsx
  const Dashboard = React.lazy(() => import("@/pages/Dashboard"));
  return (
    <React.Suspense fallback={<div className="min-h-svh" />}>
      <Dashboard />
    </React.Suspense>
  );
};

export default Index;

