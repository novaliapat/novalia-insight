import { AppHeader } from "@/components/layout/AppHeader";
import { DeclarationDashboard } from "@/components/declaration/DeclarationDashboard";

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container py-10 max-w-6xl">
        <DeclarationDashboard />
      </main>
    </div>
  );
};

export default Dashboard;
