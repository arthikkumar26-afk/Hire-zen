import {
  LayoutDashboard,
  Briefcase,
  CheckSquare,
  FileText,
  Users,
  Clock,
  Settings,
  Lightbulb,
  BookOpen,
  Share2,
  X,
  FilePlus,
  ChevronDown,
  GitBranch,
  Search,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NavLink } from "@/components/NavLink";
import { useMobileSidebar } from "@/hooks/useMobileSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { useSwipeable } from "react-swipeable";
import { useLocation } from "react-router-dom";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Briefcase, label: "Jobs", path: "/jobs" },
  { icon: FilePlus, label: "Job Templates", path: "/job-templates" },
  { icon: CheckSquare, label: "Profiles", path: "/profiles" },
  { icon: FileText, label: "My Requests", path: "/requests" },
  { icon: Users, label: "Applications", path: "/applications" },
  { icon: Clock, label: "Attendance", path: "/attendance" },
  { 
    icon: GitBranch, 
    label: "Recruitment Pipeline", 
    path: "/pipeline",
    subItems: [
      { label: "Activity Log", path: "/pipeline/activity" },
      { label: "HR", path: "/pipeline/hr" },
      { label: "Written Test", path: "/pipeline/written-test" },
      { label: "Demo Slot", path: "/pipeline/demo-slot" },
      { label: "Demo Schedule", path: "/pipeline/demo-schedule" },
      { label: "Feedback/Result", path: "/pipeline/feedback" },
      { label: "Interaction", path: "/pipeline/interaction" },
      { label: "BGV", path: "/pipeline/bgv" },
      { label: "Confirmation", path: "/pipeline/confirmation" },
      { label: "Upload Documents", path: "/pipeline/upload-documents" },
      { label: "Verify", path: "/pipeline/verify" },
      { label: "Approval", path: "/pipeline/approval" },
      { label: "Offer Letter", path: "/pipeline/offer-letter" },
      { label: "Onboarding", path: "/pipeline/onboarding" },
    ]
  },
  { icon: Share2, label: "SMM", path: "/smm", isNew: true },
  { icon: MapPin, label: "Geo-location", path: "/geo-location" },
  { icon: Settings, label: "Settings", path: "/settings" },
  { icon: Lightbulb, label: "Suggestions", path: "/communication" },
  { icon: BookOpen, label: "Knowledge Base", path: "/knowledge" },
];

const Sidebar = () => {
  const { isOpen, close, open } = useMobileSidebar();
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Swipe handlers for the sidebar
  const sidebarSwipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (isOpen) {
        close();
      }
    },
    trackMouse: false,
    trackTouch: true,
  });

  // Swipe handler for opening sidebar from left edge
  const edgeSwipeHandlers = useSwipeable({
    onSwipedRight: (eventData) => {
      // Only open if swipe starts from left edge (within 50px)
      if (!isOpen && eventData.initial[0] < 50) {
        open();
      }
    },
    trackMouse: false,
    trackTouch: true,
  });

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const sidebar = document.getElementById('mobile-sidebar');
      if (sidebar && !sidebar.contains(e.target as Node)) {
        close();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, close]);

  // Add edge swipe detector to body for opening sidebar
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      // Only handle if touch starts from left edge and sidebar is closed
      if (!isOpen && e.touches[0].clientX < 50) {
        edgeSwipeHandlers.ref(document.body);
      }
    };

    document.body.addEventListener('touchstart', handleTouchStart, { passive: true });
    return () => {
      document.body.removeEventListener('touchstart', handleTouchStart);
    };
  }, [isOpen, edgeSwipeHandlers]);

  // Filter menu items based on search query
  const filteredMenuItems = menuItems.map(item => {
    if (!searchQuery) return item;

    const itemMatches = item.label.toLowerCase().includes(searchQuery.toLowerCase());
    
    if ('subItems' in item && item.subItems) {
      const matchingSubItems = item.subItems.filter(subItem =>
        subItem.label.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      if (matchingSubItems.length > 0 || itemMatches) {
        return {
          ...item,
          subItems: matchingSubItems.length > 0 ? matchingSubItems : item.subItems,
          forceExpand: matchingSubItems.length > 0
        };
      }
      return null;
    }
    
    return itemMatches ? item : null;
  }).filter(Boolean);

  // Auto-expand items when searching or when current route matches a sub-item
  useEffect(() => {
    if (searchQuery) {
      const itemsToExpand = filteredMenuItems
        .filter((item): item is typeof item & { subItems: any[] } => 
          item && 'subItems' in item && item.subItems && item.subItems.length > 0
        )
        .map(item => item.path);
      setExpandedItems(itemsToExpand);
    } else {
      // Keep parent item expanded if current route is one of its sub-items
      const currentParent = menuItems.find(item => 
        'subItems' in item && 
        item.subItems && 
        item.subItems.some((subItem: any) => subItem.path === location.pathname)
      );
      if (currentParent && !expandedItems.includes(currentParent.path)) {
        setExpandedItems(prev => [...prev, currentParent.path]);
      }
    }
  }, [searchQuery, location.pathname]);

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={close}
        />
      )}
      
      {/* Sidebar */}
      <aside 
        {...sidebarSwipeHandlers}
        id="mobile-sidebar"
        className={cn(
          "fixed left-0 top-16 z-50 h-[calc(100vh-4rem)] w-56 border-r bg-sidebar shadow-sm transition-transform duration-300 ease-in-out",
          "lg:translate-x-0 lg:overflow-y-auto",
          isOpen ? "translate-x-0 overflow-visible" : "-translate-x-full"
        )}
      >
        {/* Close button for mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 lg:hidden"
          onClick={close}
        >
          <X className="h-4 w-4" />
        </Button>

        {/* Search input */}
        <div className="p-3 pt-12 lg:pt-3 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>

      <nav className="flex flex-col gap-1 p-3 pb-6">
        {filteredMenuItems.map((item) => {
          if (!item) return null;
          
          const hasSubItems = 'subItems' in item && item.subItems;
          const isExpanded = expandedItems.includes(item.path);
          const forceExpand = 'forceExpand' in item && item.forceExpand;
          
          if (hasSubItems) {
            return (
              <Collapsible
                key={item.path}
                open={isExpanded || forceExpand}
                onOpenChange={(open) => {
                  if (!open) {
                    setExpandedItems(prev => prev.filter(p => p !== item.path));
                  } else {
                    setExpandedItems(prev => [...prev, item.path]);
                  }
                }}
              >
                <CollapsibleTrigger asChild>
                  <button
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", (isExpanded || forceExpand) && "rotate-180")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-8 space-y-1 mt-1">
                  {item.subItems.map((subItem) => (
                    <NavLink
                      key={subItem.path}
                      to={subItem.path}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      onClick={() => {
                        if (window.innerWidth < 1024) {
                          close();
                        }
                        setSearchQuery("");
                      }}
                    >
                      {subItem.label}
                    </NavLink>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            );
          }
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
              onClick={() => {
                close();
                setSearchQuery("");
              }}
            >
              <item.icon className="h-5 w-5" />
              <span className="flex-1">{item.label}</span>
              {item.isNew ? (
                <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  NEW
                </span>
              ) : null}
            </NavLink>
          );
        })}
        
        {filteredMenuItems.length === 0 && searchQuery && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No results found for "{searchQuery}"
          </div>
        )}
      </nav>
    </aside>
    </>
  );
};

export default Sidebar;
