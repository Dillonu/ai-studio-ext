import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatToolbarModule } from "@angular/material/toolbar";

@Component({
    selector: "app-popup",
    imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, MatInputModule, MatToolbarModule],
    templateUrl: "./popup.component.html",
    styleUrls: ["./popup.component.scss"],
})
export class PopupComponent implements OnInit {
    constructor() {}

    ngOnInit(): void {
        // Check if we are on AI Studio
        this.checkAiStudioSite();
    }

    /**
     * Checks if the current page is AI Studio
     */
    checkAiStudioSite(): void {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const currentTab = tabs[0];
            const url = currentTab.url || "";

            if (url.includes("aistudio.google.com")) {
                console.log("On AI Studio site");
                this.getAIStudioInfo();
            } else {
                console.log("Not on AI Studio site");
            }
        });
    }

    /**
     * Gets information from the AI Studio page
     */
    getAIStudioInfo(): void {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tabId = tabs[0].id;
            if (tabId) {
                chrome.tabs.sendMessage(tabId, { action: "getInfo" }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error(chrome.runtime.lastError);
                        return;
                    }

                    if (response) {
                        console.log("Received info:", response);
                    }
                });
            }
        });
    }
}
