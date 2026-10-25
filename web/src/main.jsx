import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { useLiveState } from "./App.jsx";
import Bank from "./Bank.jsx";
import Live from "./Live.jsx";
import { ApiDocs, Architecture, Landing, Scripts, SiteNav } from "./Site.jsx";
import "./index.css";

// Hash routes so the one FastAPI process can serve every page without server-side routing.
function Router() {
  const [route, setRoute] = useState(location.hash || "#/");
  const live = useLiveState(); // one socket shared by both apps, so switching apps is instant
  useEffect(() => {
    const on = () => { setRoute(location.hash || "#/"); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  useEffect(() => { if (route.startsWith("#/console")) location.replace("#/live"); }, [route]);
  if (route.startsWith("#/live") || route.startsWith("#/console")) return <Live {...live} />;
  if (route.startsWith("#/bank")) return <Bank route={route} {...live} />;
  const Page = { "#/how": Architecture, "#/api": ApiDocs, "#/scripts": Scripts }[route] || Landing;
  return (
    <div className="flow h-full overflow-y-auto print:h-auto print:overflow-visible">
      <SiteNav route={route} />
      <Page />
      <footer className="text-center font-fmono text-[11px] text-fl-mute py-12 print:hidden">scammer gets scammed · cal hacks 13.0 · calhacks federal credit union is a fictional demo bank</footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Router />);
