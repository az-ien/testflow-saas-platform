import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { qeAPI } from '../../services/api';

interface QeState {
  summary: any | null;
  loading: boolean;
  error: string | null;
}

export const fetchQeSummary = createAsyncThunk('qe/summary', async (_, { rejectWithValue }) => {
  try {
    const { data } = await qeAPI.summary();
    return data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || 'Failed to load quality summary');
  }
});

const qeSlice = createSlice({
  name: 'qe',
  initialState: { summary: null, loading: false, error: null } as QeState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchQeSummary.pending, (s) => { s.loading = true; })
      .addCase(fetchQeSummary.fulfilled, (s, a) => { s.loading = false; s.summary = a.payload; })
      .addCase(fetchQeSummary.rejected, (s, a) => { s.loading = false; s.error = a.payload as string; });
  },
});

export default qeSlice.reducer;
