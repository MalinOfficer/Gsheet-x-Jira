/* LayoutDashboard - EDU PROFESSIONAL STYLE */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Menu, Settings, LayoutDashboard, ListTree, BarChart, Database,
  GitBranch, Files, Combine, RefreshCw, HardHat, LogOut, User,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useContext, useEffect, useRef, useState, useCallback } from "react";
import { TableDataContext } from "@/store/table-data-context";
import { useIsMobile } from "@/hooks/use-mobile";
import React from "react";
import { ThemeSwitch } from "../ui/theme-switch";
import { useAuth } from "@/contexts/AuthContext";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import type { LucideProps } from "lucide-react";
import {
  type MenuVisibility,
  DEFAULT_MENU_VISIBILITY,
  MENU_VISIBILITY_KEY,
} from "@/app/settings/page";
import { createPortal } from "react-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type NavItem = {
  href: string;
  label: string;
  icon: ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;
  disabled?: boolean;
  visibilityKey?: keyof MenuVisibility;
};

const navItems: Record<string, NavItem[]> = {
  Management: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/", label: "Import Data", icon: ListTree, visibilityKey: "showImportData" },
    { href: "/db", label: "All Cases", icon: Database },
  ],
  Reports: [
    { href: "/report-harian", label: "Daily Report", icon: BarChart, visibilityKey: "showDailyReport" },
    { href: "/knowledge-base", label: "Knowledge Base", icon: HardHat, disabled: true, visibilityKey: "showKnowledgeBase" },
  ],
  Tools: [
    { href: "/migrasi-murid", label: "Migrasi Murid", icon: GitBranch, visibilityKey: "showMigrasiMurid" },
    { href: "/cek-duplikasi", label: "Cek Duplikasi", icon: Files, visibilityKey: "showSecondaryTools" },
    { href: "/data-weaver", label: "Edit NIS", icon: Combine, visibilityKey: "showSecondaryTools" },
  ],
};

type NavCategory = keyof typeof navItems;

// ─────────────────────────────────────────────────────────────────────────────
// SidebarTooltip — FIX: sembunyikan di mobile agar tidak bocor ke Sheet
// ─────────────────────────────────────────────────────────────────────────────
function SidebarTooltip({ label, children, disabled }: { label: string; children: React.ReactNode; disabled?: boolean }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const show = useCallback(() => {
    if (disabled || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.top + rect.height / 2, left: rect.left + 60 + 6 });
  }, [disabled]);

  const hide = useCallback(() => setPos(null), []);

  // FIX: cleanup tooltip saat komponen unmount
  useEffect(() => {
    return () => setPos(null);
  }, []);

  return (
    <>
      <div ref={triggerRef} onMouseEnter={show} onMouseLeave={hide} style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        {children}
      </div>
      {pos && !disabled && createPortal(
        <div style={{
          position: "fixed",
          top: pos.top,
          left: pos.left,
          transform: "translateY(-50%)",
          zIndex: 9999,
          pointerEvents: "none",
          backgroundColor: "#18181b",
          color: "#fafafa",
          border: "1px solid #3f3f46",
          borderRadius: "6px",
          padding: "5px 10px",
          fontSize: "12px",
          fontWeight: 500,
          whiteSpace: "nowrap",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          lineHeight: "1.4",
        }}>
          {label}
        </div>,
        document.body
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// useMenuVisibility
// ─────────────────────────────────────────────────────────────────────────────
function useMenuVisibility(): MenuVisibility {
  const { prefs } = useUserPreferences();
  const [visibility, setVisibility] = useState<MenuVisibility>(DEFAULT_MENU_VISIBILITY);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MENU_VISIBILITY_KEY);
      if (saved) setVisibility({ ...DEFAULT_MENU_VISIBILITY, ...JSON.parse(saved) });
    } catch {}
  }, []);

  useEffect(() => {
    if (!prefs.menuVisibility) return;
    const merged = { ...DEFAULT_MENU_VISIBILITY, ...prefs.menuVisibility };
    setVisibility(merged);
    try { localStorage.setItem(MENU_VISIBILITY_KEY, JSON.stringify(merged)); } catch {}
  }, [prefs.menuVisibility]);

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<MenuVisibility>;
      if (custom.detail) setVisibility(custom.detail);
    };
    window.addEventListener("menuVisibilityChange", handler);
    return () => window.removeEventListener("menuVisibilityChange", handler);
  }, []);

  return visibility;
}

// ─────────────────────────────────────────────────────────────────────────────
// useSidebarCollapsed — FIX: reset collapsed saat mobile
// ─────────────────────────────────────────────────────────────────────────────
function useSidebarCollapsed(isMobile: boolean) {
  const { prefs, updatePref } = useUserPreferences();
  const [collapsed, setCollapsed] = useState<boolean>(false);

  useEffect(() => {
    // FIX: jangan load persisted state di mobile
    if (isMobile) {
      setCollapsed(false);
      return;
    }
    try {
      const saved = localStorage.getItem("sidebar-collapsed");
      if (saved !== null) setCollapsed(JSON.parse(saved));
    } catch {}
  }, [isMobile]);

  useEffect(() => {
    if (isMobile || prefs.sidebarCollapsed === undefined) return;
    setCollapsed(prefs.sidebarCollapsed);
    try { localStorage.setItem("sidebar-collapsed", JSON.stringify(prefs.sidebarCollapsed)); } catch {}
  }, [prefs.sidebarCollapsed, isMobile]);

  const toggle = useCallback(() => {
    if (isMobile) return; // FIX: jangan toggle di mobile
    setCollapsed(prev => {
      const next = !prev;
      updatePref('sidebarCollapsed', next);
      try { localStorage.setItem("sidebar-collapsed", JSON.stringify(next)); } catch {}
      return next;
    });
  }, [updatePref, isMobile]);

  return { collapsed, toggle };
}

// ─────────────────────────────────────────────────────────────────────────────
// NavLinks
// ─────────────────────────────────────────────────────────────────────────────
function NavLinks({ isMobile = false, collapsed = false }: { isMobile?: boolean; collapsed?: boolean }) {
  const pathname       = usePathname();
  const menuVisibility = useMenuVisibility();

  const isVisible = (item: NavItem) =>
    !item.visibilityKey || menuVisibility[item.visibilityKey] === true;

  return (
    <nav className={cn("flex flex-col gap-0 py-2 w-full", collapsed ? "px-0" : "px-2")}>
      {(Object.keys(navItems) as NavCategory[]).map(category => {
        const visibleItems = navItems[category].filter(isVisible);
        if (visibleItems.length === 0) return null;

        return (
          <div key={category} className="mb-4">
            <div className={cn(
              "transition-all duration-300 overflow-hidden mb-2 px-1",
              collapsed ? "h-0 opacity-0" : "h-auto opacity-100"
            )}>
              <h2 className="text-[10px] font-bold uppercase tracking-[0.1em] text-sidebar-foreground/40">
                {category}
              </h2>
            </div>

            <div className="space-y-1">
              {visibleItems.map((item) => {
                const isActive = pathname === item.href;

                if (isMobile) {
                  return (
                    <SheetClose key={item.label} asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 text-sm font-medium transition-all rounded-md",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                          item.disabled && "pointer-events-none opacity-50"
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    </SheetClose>
                  );
                }

                if (collapsed) {
                  return (
                    <SidebarTooltip key={item.label} label={item.label}>
                      {/* FIX: wrapper flex justify-center agar icon benar-benar center di sidebar 70px */}
                      <div className="flex w-full justify-center">
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-center justify-center h-10 w-10 rounded-lg transition-all",
                            isActive
                              ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg"
                              : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                            item.disabled && "pointer-events-none opacity-40"
                          )}
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                        </Link>
                      </div>
                    </SidebarTooltip>
                  );
                }

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 text-sm font-medium transition-all rounded-md group",
                      isActive
                        ? "bg-sidebar-accent/80 text-sidebar-foreground shadow-sm"
                        : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                      item.disabled && "pointer-events-none opacity-40"
                    )}
                  >
                    <item.icon className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      isActive ? "text-sidebar-primary" : "group-hover:text-sidebar-foreground"
                    )} />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProcessingIndicator
// ─────────────────────────────────────────────────────────────────────────────
function ProcessingIndicator() {
  const { isProcessing } = useContext(TableDataContext);
  if (!isProcessing) return null;
  return (
    <div className="flex items-center gap-2 text-primary animate-pulse">
      <RefreshCw className="h-4 w-4 animate-spin" />
      <span className="hidden sm:inline text-xs font-semibold">SYNCING...</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UserProfile — sudah benar, gunakan handleLogout dari sini
// ─────────────────────────────────────────────────────────────────────────────
function UserProfile() {
  const { user, logout } = useAuth();
  const { clearPrefsCache } = useUserPreferences();

  const handleLogout = useCallback(() => {
    clearPrefsCache();
    logout();
  }, [clearPrefsCache, logout]);

  return (
    <div className="flex items-center gap-3 pl-4 border-l border-border ml-2">
      <div className="hidden sm:flex flex-col items-end text-right">
        <span className="text-sm font-bold text-foreground leading-none">{user?.username || "Anonymous"}</span>
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-1">{user?.role || "Administrator"}</span>
      </div>
      <Link href="/settings">
        <Avatar className="h-9 w-9 border-2 border-background shadow-soft hover:scale-105 transition-transform">
          <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`} />
          <AvatarFallback>{user?.username?.substring(0, 2).toUpperCase() || "US"}</AvatarFallback>
        </Avatar>
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SidebarFooter — FIX: extract logout ke level komponen, bukan di JSX inline
// ─────────────────────────────────────────────────────────────────────────────
function SidebarFooter({ collapsed, pathname }: { collapsed: boolean; pathname: string }) {
  // FIX: useAuth dipanggil di level komponen, bukan di dalam JSX/onClick
  const { logout } = useAuth();
  const { clearPrefsCache } = useUserPreferences();

  const handleLogout = useCallback(() => {
    clearPrefsCache();
    logout();
  }, [clearPrefsCache, logout]);

  if (!collapsed) {
    return (
      <div className="space-y-1">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all group",
            pathname === "/settings"
              ? "bg-sidebar-accent text-sidebar-foreground"
              : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span>Settings</span>
        </Link>
        {/* FIX: handleLogout dari state komponen, bukan useAuth() inline */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground/60 hover:bg-red-500/10 hover:text-red-400 transition-all"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    );
  }

  return (
    <SidebarTooltip label="Settings">
      <div className="flex w-full justify-center">
        <Link
          href="/settings"
          className={cn(
            "flex items-center justify-center h-10 w-10 rounded-lg transition-all",
            pathname === "/settings"
              ? "bg-sidebar-accent text-sidebar-foreground"
              : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
          )}
        >
          <Settings className="h-5 w-5" />
        </Link>
      </div>
    </SidebarTooltip>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ClientLayout — Main
// ─────────────────────────────────────────────────────────────────────────────
export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname              = usePathname();
  const isMobile              = useIsMobile();
  const { setIsProcessing }   = useContext(TableDataContext);
  // FIX: pass isMobile ke useSidebarCollapsed agar reset di mobile
  const { collapsed, toggle } = useSidebarCollapsed(isMobile);

  const pageTitles: Record<string, string> = {
    "/":               "Management",
    "/dashboard":      "Management",
    "/db":             "All Case Database",
    "/knowledge-base": "Knowledge Base",
    "/report-harian":  "Daily Reports",
    "/migrasi-murid":  "Student Migration",
    "/cek-duplikasi":  "Duplicate Checker",
    "/data-weaver":    "NIS Editor",
    "/settings":       "System Settings",
  };

  const breadcrumbLabel = pathname === "/" ? "Import Flow" : pageTitles[pathname] || "Console";

  useEffect(() => { setIsProcessing(false); }, [pathname, setIsProcessing]);

  if (pathname === "/login") return <>{children}</>;
  if (pathname === "/migrasi-murid") {
    return <div className="h-full flex flex-col bg-background">{children}</div>;
  }

  return (
    <div className={cn(
      "flex h-screen w-full bg-background overflow-hidden font-sans",
      isMobile ? "flex-col" : "flex-row",
    )}>
      {/* ── Desktop Sidebar ── */}
      {!isMobile && (
        <aside className={cn(
          "flex flex-col h-screen bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out border-r border-sidebar-border z-50 flex-shrink-0",
          collapsed ? "w-[70px]" : "w-[240px]",
        )}>
          {/* Sidebar Header / Logo */}
          <div className={cn(
            "h-16 flex items-center shrink-0 border-b border-sidebar-border/50",
            collapsed ? "justify-center px-0" : "px-4"
          )}>
            <Link href="/" className={cn(
              "flex items-center overflow-hidden min-w-0",
              collapsed ? "gap-0 justify-center" : "gap-3"
            )}>
              <div className="w-10 h-10 bg-sidebar-primary rounded-xl flex items-center justify-center text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/20 shrink-0">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-base font-bold text-white leading-tight whitespace-nowrap">CS Support</span>
                  <span className="text-[10px] text-white/40 font-semibold tracking-widest uppercase">Admin Console</span>
                </div>
              )}
            </Link>
          </div>

          {/* Nav Links */}
          <div className="flex-1 overflow-y-auto scrollbar-none py-2">
            <NavLinks collapsed={collapsed} />
          </div>

          {/* Sidebar Footer */}
          <div className={cn(
            "border-t border-sidebar-border/50",
            collapsed ? "p-2" : "p-4"
          )}>
            <SidebarFooter collapsed={collapsed} pathname={pathname} />
          </div>
        </aside>
      )}

      {/* ── Main Content Area ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* ── Header ── */}
        <header className="h-16 flex items-center justify-between px-4 lg:px-8 bg-white dark:bg-card border-b border-border z-40 shadow-soft flex-shrink-0">
          <div className="flex items-center gap-4">
            {/* FIX: tombol collapse hanya tampil di desktop */}
            {!isMobile && (
              <Button variant="ghost" size="icon" onClick={toggle} className="text-muted-foreground hover:text-primary">
                {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
              </Button>
            )}
            {isMobile && (
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="mr-2">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-[260px] bg-sidebar text-sidebar-foreground border-none">
                  <SheetHeader className="h-16 flex flex-row items-center border-b border-white/10 px-4">
                    <SheetTitle asChild>
                      <Link href="/" className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center text-sidebar-primary-foreground">
                          <LayoutDashboard className="h-4 w-4" />
                        </div>
                        <span className="text-lg font-bold text-white">EduDash</span>
                      </Link>
                    </SheetTitle>
                  </SheetHeader>
                  <div className="flex-1 overflow-y-auto">
                    <NavLinks isMobile={true} />
                  </div>
                </SheetContent>
              </Sheet>
            )}
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span className="hidden sm:inline">Admin Console</span>
              <span className="hidden sm:inline">/</span>
              <span className="text-foreground font-bold">{breadcrumbLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <ProcessingIndicator />
            <div className="hidden sm:block">
              <ThemeSwitch />
            </div>
            <UserProfile />
          </div>
        </header>

        {/* ── Page Content ── */}
        <main className="flex-1 bg-[#f8f9fc] dark:bg-background/50 overflow-hidden relative min-h-0">
          <div className="h-full w-full overflow-y-auto custom-scrollbar p-0 lg:p-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}