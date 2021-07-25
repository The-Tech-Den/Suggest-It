import {readFileSync} from 'fs'

interface FeedbackCooldownStore {
    timer:any,
    endTime:number;
};

interface FeedbackUserStore {
    [userID:string]:FeedbackCooldownStore
};

const defaultCooldownMs = 1000;

class FeedbackStore {
    store:FeedbackUserStore;
    constructor(){
        this.store = {};
    };
    /** Create a store */
    start(userID:string){
        this.store[userID] = {
            "timer":setTimeout(() => {
                this.store[userID] = undefined;
            }, defaultCooldownMs),
            "endTime":new Date().getTime() + defaultCooldownMs
        }
        console.log(this.store[userID].endTime)
    }
    /** Reset the 15 minute cooldown  */
    resetTimer(userID:string){
        clearTimeout(this.store[userID].timer)
        this.store[userID].timer = setTimeout(() => {
            this.store[userID] = undefined;
        }, defaultCooldownMs)
    }
    getRemainingTime(userID:string){
        return (this.store[userID].endTime - new Date().getTime())
    }
    getCooldownEndTime(userID:string){
        return this.store[userID].endTime
    }
    sessionExists(userID:string){
        return this.store[userID]?true:false
    }
    /** Cancel the current user's cooldown */
    cancel(userID:string){
        clearTimeout(this.store[userID].timer)
        this.store[userID] = undefined;
    };
};

export default FeedbackStore;