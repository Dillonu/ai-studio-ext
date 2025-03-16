import { Routes } from "@angular/router";
import { PopupComponent } from "./popup/popup.component";
/**
 * Application route configuration.
 * Defines the available routes and their components:
 * - /new-story: Displays the new story form
 * - /view-story/:id: Displays the view story form
 */
export const routes: Routes = [
    {
        path: "",
        redirectTo: "popup",
        pathMatch: "full",
    },
    {
        path: "popup",
        component: PopupComponent,
    },
    {
        path: "**",
        redirectTo: "popup",
    },
];
