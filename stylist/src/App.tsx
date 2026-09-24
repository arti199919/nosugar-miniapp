import { lazy, Suspense, useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Spinner, Toasts } from "./components/ui";
import { useUI } from "./store";
import { startReminders } from "./lib/reminders";

const Home = lazy(() => import("./pages/Home"));
const Stylist = lazy(() => import("./pages/Stylist"));
const Wardrobe = lazy(() => import("./pages/Wardrobe"));
const Fitting = lazy(() => import("./pages/Fitting"));
const Looks = lazy(() => import("./pages/Looks"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Mirror = lazy(() => import("./pages/Mirror"));
const Shop = lazy(() => import("./pages/Shop"));
const Chat = lazy(() => import("./pages/Chat"));
const Profile = lazy(() => import("./pages/Profile"));

export function App() {
  const checkHealth = useUI((s) => s.checkHealth);
  useEffect(() => {
    checkHealth();
    const t = startReminders();
    return () => clearInterval(t);
  }, [checkHealth]);
  return (
    <Layout>
      <Toasts />
      <Suspense
        fallback={
          <div className="flex h-[60vh] items-center justify-center text-muted">
            <Spinner size={24} />
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/stylist" element={<Stylist />} />
          <Route path="/wardrobe" element={<Wardrobe />} />
          <Route path="/fitting" element={<Fitting />} />
          <Route path="/looks" element={<Looks />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/mirror" element={<Mirror />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
