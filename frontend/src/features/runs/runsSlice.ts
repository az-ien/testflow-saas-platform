import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { runsAPI } from '../../services/api';

interface RunsState {
  items: any[];
  currentRun: any | null;
  loading: boolean;
  error: string | null;
}

export const fetchRuns = createAsyncThunk('runs/fetch', async (params: any, { rejectWithValue }) => {
  try { const { data } = await runsAPI.list(params); return data; }
  catch (err: any) { return rejectWithValue(err.response?.data?.error); }
});

export const triggerRun = createAsyncThunk('runs/trigger', async (payload: { projectId: string; branch?: string }, { rejectWithValue }) => {
  try { const { data } = await runsAPI.trigger(payload); return data; }
  catch (err: any) { return rejectWithValue(err.response?.data?.error); }
});

export const fetchRun = createAsyncThunk('runs/fetchOne', async (id: string, { rejectWithValue }) => {
  try { const { data } = await runsAPI.get(id); return data; }
  catch (err: any) { return rejectWithValue(err.response?.data?.error); }
});

const runsSlice = createSlice({
  name: 'runs',
  initialState: { items: [], currentRun: null, loading: false, error: null } as RunsState,
  reducers: {
    clearError(state) { state.error = null; },
    updateRunStatus(state, action) {
      const idx = state.items.findIndex(r => r.id === action.payload.id);
      if (idx !== -1) state.items[idx] = { ...state.items[idx], ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRuns.pending, (s) => { s.loading = true; })
      .addCase(fetchRuns.fulfilled, (s, a) => { s.loading = false; s.items = a.payload.runs; })
      .addCase(fetchRuns.rejected, (s, a) => { s.loading = false; s.error = a.payload as string; })
      .addCase(triggerRun.fulfilled, (s, a) => { s.items.unshift({ id: a.payload.runId, status: 'queued', ...a.payload }); })
      .addCase(fetchRun.fulfilled, (s, a) => { s.currentRun = a.payload; });
  },
});

export const { clearError, updateRunStatus } = runsSlice.actions;
export default runsSlice.reducer;
