import { defineRouter } from '#q-app/wrappers';
import { useAuth } from '../stores/auth';
import {
  createRouter,
  createMemoryHistory,
  createWebHistory,
  createWebHashHistory,
} from 'vue-router'
import routes from './routes';

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

export default defineRouter(function ( { store } ) {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : process.env.VUE_ROUTER_MODE === 'history'
      ? createWebHistory
      : createWebHashHistory

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,
    // Leave this as is and make changes in quasar.conf.js instead!
    // quasar.conf.js -> build -> vueRouterMode
    // quasar.conf.js -> build -> publicPath
    history: createHistory(process.env.VUE_ROUTER_BASE),
  })
  // Blocks /login if you’re authenticated (redirect to /projects)
	// Blocks protected routes if you’re not authenticated (redirect to /login)
    Router.beforeEach((to) => {
    // to is an object that represents where the user is trying to go.
    // It includes useful properties like:
//     {
//         path: '/projects',     // The full path they're navigating to
//         name: 'Projects',      // (if you named your route)
//         params: {},            // Dynamic parameters (e.g. /projects/:id)
//         query: {},             // Query params (?page=2)
//         matched: [...]         // Matched route records
//       }
    // In Pinia you can get a store bound to a specific Pinia instance by passing it:
    const auth = useAuth(store) // <- pass the Pinia instance Quasar provided
    const isAuthed = !!auth.token
    const publicRoutes = ['/login']

    if (!isAuthed && !publicRoutes.includes(to.path)) return '/login'
    if (isAuthed && to.path === '/login') return '/projects'
  })
  return Router
});

// src/stores/auth.ts

// export const useAuth = defineStore('auth', {
//     state: () => ({ token: localStorage.getItem('jwt') as string | null, user:null as null | { id:number; email:string; name:string | null } }),
//     actions: {
//         setAuth(token:string, user: any){
//             this.token = token;
//             this.user = user;
//             localStorage.setItem('jwt', token);
//         },
//         logout() {
//             this.token = null; this.user = null;
//             localStorage.removeItem('jwt');
//         }
//     }
// });
