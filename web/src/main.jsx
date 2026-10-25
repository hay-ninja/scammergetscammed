import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { ApiDocs, Architecture, Landing, Scripts, SiteNav } from "./Site.jsx";
import "./index.css";

// Hash routes so the one FastAPI process can serve every page without server-side routing.
function Router() {
  const [route, setRoute] = useState(location.hash || "#/");
  useEffect(() => {
    const on = () => { setRoute(location.hash || "#/"); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  if (route.startsWith("#/console")) return <App />;
  const Page = { "#/how": Architecture, "#/api": ApiDocs, "#/scripts": Scripts }[route] || Landing;
  return (
    <div className="h-full overflow-y-auto print:h-auto print:overflow-visible">
      <SiteNav route={route} />
      <Page />
      <footer className="text-center text-xs text-ink-400 py-10 print:hidden">Scammer Gets Scammed · Cal Hacks 13.0 · Bay Federal Credit Union is a fictional demo bank.</footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Router />);
