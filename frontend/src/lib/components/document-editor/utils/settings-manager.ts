import { browser } from '$app/environment';

export interface EditorSettings {
    font: string;
    fontSize: string;
    lastModified: string;
}

export function saveSettings(
    storyId: string,
    font: string,
    fontSize: string
): void {
    if (!browser) return;

    try {
        const settings: EditorSettings = {
            font,
            fontSize,
            lastModified: new Date().toISOString()
        };
        localStorage.setItem(`document_settings_${storyId}`, JSON.stringify(settings));
    } catch (err) {
        console.error('Error saving settings:', err);
    }
}

export function loadSettings(storyId: string): EditorSettings | null {
    if (!browser) return null;

    try {
        const settings = localStorage.getItem(`document_settings_${storyId}`);
        if (settings) {
            return JSON.parse(settings) as EditorSettings;
        }
    } catch (err) {
        console.error('Error loading settings:', err);
    }
    return null;
}

export function applySettings(
    editor: HTMLDivElement,
    font: string,
    fontSize: string
): void {
    if (!editor) return;
    editor.style.fontFamily = font;
    editor.style.fontSize = fontSize;
} 