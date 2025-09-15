export class ConfigManager {
    private config: { [key: string]: any };
    private secureConfig: { [key: string]: any };

    constructor() {
        this.config = {};
        this.secureConfig = {};
        this.loadConfig();
    }

    get(key: string): any {
        return this.getNestedValue(this.config, key);
    }

    getSecure(key: string): any {
        return this.getNestedValue(this.secureConfig, key);
    }

    set(key: string, value: any): void {
        this.setNestedValue(this.config, key, value);
    }

    setSecure(key: string, value: any): void {
        this.setNestedValue(this.secureConfig, key, value);
    }

    private loadConfig(): void {
        // Load configuration from environment variables or config files
        // Implement secure loading of sensitive data
    }

    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => 
            current && current[key] !== undefined ? current[key] : undefined, obj);
    }

    private setNestedValue(obj: any, path: string, value: any): void {
        const keys = path.split('.');
        const lastKey = keys.pop()!;
        const target = keys.reduce((current, key) => {
            if (!(key in current)) {
                current[key] = {};
            }
            return current[key];
        }, obj);
        target[lastKey] = value;
    }
}