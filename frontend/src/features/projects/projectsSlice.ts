import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { projectsAPI } from '../../services/api';

interface ProjectsState {
  items: any[];
  loading: boolean;
  error: string | null;
}

export const fetchProjects = createAsyncThunk('projects/fetch', async (_, { rejectWithValue }) => {
  try { const { data } = await projectsAPI.list(); return data.projects; }
  catch (err: any) { return rejectWithValue(err.response?.data?.error); }
});

export const createProject = createAsyncThunk('projects/create', async (payload: any, { rejectWithValue }) => {
  try { const { data } = await projectsAPI.create(payload); return data; }
  catch (err: any) { return rejectWithValue(err.response?.data?.error); }
});

export const deleteProject = createAsyncThunk('projects/delete', async (id: string, { rejectWithValue }) => {
  try { await projectsAPI.delete(id); return id; }
  catch (err: any) { return rejectWithValue(err.response?.data?.error); }
});

const projectsSlice = createSlice({
  name: 'projects',
  initialState: { items: [], loading: false, error: null } as ProjectsState,
  reducers: { clearError(state) { state.error = null; } },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjects.pending, (s) => { s.loading = true; })
      .addCase(fetchProjects.fulfilled, (s, a) => { s.loading = false; s.items = a.payload; })
      .addCase(fetchProjects.rejected, (s, a) => { s.loading = false; s.error = a.payload as string; })
      .addCase(createProject.fulfilled, (s, a) => { s.items.unshift(a.payload); })
      .addCase(deleteProject.fulfilled, (s, a) => { s.items = s.items.filter(p => p.id !== a.payload); });
  },
});

export const { clearError } = projectsSlice.actions;
export default projectsSlice.reducer;
