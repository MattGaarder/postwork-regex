<template>
  <div class="q-pa-md q-gutter-md" style="max-width:400px; margin:auto;">
    <q-input v-model="email" label="Email" />
    <q-input v-model="password" label="Password" type="password" />
    <q-input v-model="name" label="Name (optional for register)" />
    <div class="row q-gutter-sm">
      <q-btn label="Register" color="primary" @click="register" />
      <q-btn label="Login" color="secondary" flat @click="login" />
    </div>
  </div>
</template>

<script setup >
  import { ref, onMounted } from 'vue';
  // api is the Axios client from web/lib/http.ts.
	// baseURL: import.meta.env.VITE_API_URL turns '/projects' into something like http://localhost:3000/projects.
	// the request interceptor runs before the request is sent:
  import { api } from '../lib/http';
  import { useAuth } from '../stores/auth';
  import { useRouter } from 'vue-router';

  const email = ref(''); 
  const password = ref(''); 
  const name = ref('');
  const isRegistering = ref(false)
  const isLoggingIn = ref(false)
  const errorMsg = ref('')
  const auth = useAuth(); 
  const router = useRouter();

  // If already logged in, skip this page
  onMounted(() => {
    if (auth.token) router.push('/projects')
  });

  async function register() {
    errorMsg.value = '';
    isRegistering.value = true;
    try {
      const { data } = await api.post('/auth/register', { 
        email: email.value, 
        password: password.value, 
        name: name.value || undefined 
      });
      auth.setAuth(data.token, data.user); // auto-login after register
      // Vue Router (frontend)
      // router.push('/projects') → changes the browser URL and shows the Projects page component.
      // does not automatically call your backend. it’s just navigation inside the SPA.
      router.push('/projects');
    } catch (err) {
      errorMsg.value = humanizeError(err);
    } finally {
      isRegistering.value = false;
    }
  }

  async function login() {
    errorMsg.value = '';
    isLoggingIn.value = true;
    try {
      const { data } = await api.post('/auth/login', {
        email: email.value,
        password: password.value
      });
      auth.setAuth(data.token, data.user);
      router.push('/projects');
    } catch (err) {
      errorMsg.value = humanizeError(err);
    } finally {
      isLoggingIn.value = false;
    }
  }

  function humanizeError(err) {
    const status = err?.response?.status
    const msg = err?.response?.data?.error
    if (status === 409) return 'Email already in use'
    if (status === 401) return 'Invalid email or password'
    return msg || 'Something went wrong'
  }

</script>