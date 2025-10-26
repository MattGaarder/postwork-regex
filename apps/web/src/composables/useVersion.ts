// apps/web/src/composables/useVersion.ts
import { ref } from 'vue';
import { api } from '../lib/http';  // use alias if configured, else '../../lib/http'
import { useRouter } from 'vue-router';



const enumToMonaco = (lang?: string) => {
  switch (lang) {
    case 'JAVASCRIPT': return 'javascript'
    case 'PYTHON':     return 'python'
    case 'JAVA':       return 'java'
    default:           return 'plaintext'
  }
}

export function useVersion(projectId: number, versionId: number) {
  const router = useRouter();
  const code   = ref('');
  
  const language  = ref('plaintext'); // monaco language id
  const path      = ref<string | null>(null);
  const createdAt = ref<string | null>(null);
  const updatedAt = ref<string | null>(null);

  const isSaving = ref(false);
  const isLoading = ref(false);
  const errorMsg = ref('');

  async function refresh() {
    errorMsg.value = '';
    isLoading.value = true;
    console.log('[useVersion.refresh] GET /projects/%s/v/%s', projectId, versionId);
    
    try {
      const { data } = await api.get(`/projects/${projectId}/v/${versionId}`);
      console.log('[useVersion.refresh] response:', data);
      code.value   = data.code;
      language.value  = enumToMonaco(data.language);   // Prisma enum → Monaco id
      path.value      = data.path ?? null;
      createdAt.value = data.createdAt ?? null;
      updatedAt.value = data.updatedAt ?? null;
    } catch (err: any) {
      errorMsg.value = err?.response?.data?.error || 'Failed to load file.';
    } finally {
      isLoading.value = false;
    }

  }

  async function save(newContent?: string) {
    errorMsg.value = '';
    isSaving.value = true;
    const payload = { code: newContent ?? code.value };
    console.log('[useVersion.save] POST /projects/%s/v payload=', projectId, payload);
    try {
      const { data } = await api.post(`/projects/${projectId}/v`, payload);
      console.log('[useVersion.save] created new version id=', data.id, 'response=', data);
      code.value = data.code;
      language.value  = enumToMonaco(data.language);
      updatedAt.value = data.updatedAt ?? updatedAt.value;
      createdAt.value = data.createdAt ?? createdAt.value;

      router.push(`/projects/${projectId}/v/${data.id}`)
    } catch (err: any) {
      errorMsg.value = err?.response?.data?.error || 'Failed to save.';
    } finally {
      isSaving.value = false;
    }
  }

  return { code, language, path, createdAt, updatedAt, isLoading, isSaving, errorMsg, refresh, save }
}

