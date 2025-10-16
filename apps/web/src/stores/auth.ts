import { defineStore } from "pinia";

export const useAuth = defineStore('auth', {
    state: () => ({ token: localStorage.getItem('jwt') as string | null, user:null as null | { id:number; email:string; name:string | null } }),
    actions: {
        setAuth(token:string, user: any){
            this.token = token;
            this.user = user;
            localStorage.setItem('jwt', token);
        },
        logout() {
            this.token = null; this.user = null;
            localStorage.removeItem('jwt');
        }
    }
});