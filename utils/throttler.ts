export class APIThrottler {
    private queue: Array<() => Promise<any>> = [];
    private processing = false;
    private lastRequestTime = 0;
    private minInterval: number;
    private timestamps: number[] = []; // For window-based throttling (AV)
    private windowSize: number;
    private maxRequestsInWindow: number;

    constructor(minInterval: number, maxRequestsInWindow: number = Infinity, windowSize: number = 0) {
        this.minInterval = minInterval;
        this.maxRequestsInWindow = maxRequestsInWindow;
        this.windowSize = windowSize;
    }

    async add<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    const result = await fn();
                    resolve(result);
                } catch (e) {
                    reject(e);
                }
            });
            this.process();
        });
    }

    private async process() {
        if (this.processing) return;
        this.processing = true;

        while (this.queue.length > 0) {
            const now = Date.now();
            let waitTime = 0;

            // 1. Check Min Interval
            const timeSinceLast = now - this.lastRequestTime;
            if (timeSinceLast < this.minInterval) {
                waitTime = Math.max(waitTime, this.minInterval - timeSinceLast);
            }

            // 2. Check Window (for Alpha Vantage)
            if (this.maxRequestsInWindow < Infinity && this.timestamps.length >= this.maxRequestsInWindow) {
                // Clean up old timestamps
                this.timestamps = this.timestamps.filter(t => now - t < this.windowSize);

                if (this.timestamps.length >= this.maxRequestsInWindow) {
                    // Still full, wait until the oldest one expires
                    const oldest = this.timestamps[0];
                    const timeUntilExpiry = this.windowSize - (now - oldest);
                    waitTime = Math.max(waitTime, timeUntilExpiry + 100); // +100ms buffer
                }
            }

            if (waitTime > 0) {
                await new Promise(r => setTimeout(r, waitTime));
                continue; // Re-evaluate time after waiting
            }

            // Execute
            const task = this.queue.shift();
            if (task) {
                this.lastRequestTime = Date.now();
                this.timestamps.push(this.lastRequestTime);
                await task();
            }
        }

        this.processing = false;
    }
}
