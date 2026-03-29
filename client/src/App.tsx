import { useState, useEffect } from "react";
import { Routes, Route } from "react-router";
import Header from "./components/shared/Header";
import FontSizeControl from "./components/shared/FontSizeControl";
import { FullscreenProvider, useFullscreen } from "./contexts/FullscreenContext";
import Dashboard from "./pages/Dashboard";
import NewTopic from "./pages/NewTopic";
import TopicDetail from "./pages/TopicDetail";
import Lesson from "./pages/Lesson";
import Review from "./pages/Review";
import Concepts from "./pages/Concepts";
import Usage from "./pages/Usage";
import Login from "./pages/Login";

type AuthState = "loading" | "authenticated" | "unauthenticated";

function AppContent() {
  const { isFullscreen } = useFullscreen();
  return (
    <div className="min-h-screen bg-zinc-50">
      {!isFullscreen && <Header />}
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/topics/new" element={<NewTopic />} />
        <Route path="/topics/:id" element={<TopicDetail />} />
        <Route path="/lessons/:id" element={<Lesson />} />
        <Route path="/review" element={<Review />} />
        <Route path="/concepts" element={<Concepts />} />
        <Route path="/usage" element={<Usage />} />
      </Routes>
      <FontSizeControl />
    </div>
  );
}

export default function App() {
  const [authState, setAuthState] = useState<AuthState>("loading");

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => setAuthState(r.ok ? "authenticated" : "unauthenticated"))
      .catch(() => setAuthState("unauthenticated"));
  }, []);

  if (authState === "loading") return null;
  if (authState === "unauthenticated") return <Login />;

  return (
    <FullscreenProvider>
      <AppContent />
    </FullscreenProvider>
  );
}
