import { Link, useLocation } from "react-router";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/review", label: "Review" },
  { to: "/concepts", label: "Concepts" },
  { to: "/usage", label: "Usage" },
];

export default function Header() {
  const location = useLocation();

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link to="/" className="text-lg font-semibold text-zinc-900">
          Socratic
        </Link>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors sm:px-3 sm:py-1.5 sm:text-sm ${
                item.label === "Dashboard" ? "hidden sm:inline" : ""
              } ${
                location.pathname === item.to
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <button
            onClick={() => (window.location.href = "/api/auth/logout")}
            className="ml-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors sm:ml-2 sm:px-3 sm:py-1.5 sm:text-sm"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
