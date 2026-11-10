import { createContext, useContext } from "react";

/** Lets any page toggle the app sidebar (the editor has its own bar instead of the app header). */
export const SidebarControlContext = createContext<{ toggle: () => void }>({ toggle: () => {} });

export const useSidebarControl = () => useContext(SidebarControlContext);
