import { configureStore } from '@reduxjs/toolkit';
import authReducer from './features/auth/authSlice';
import runsReducer from './features/runs/runsSlice';
import projectsReducer from './features/projects/projectsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    runs: runsReducer,
    projects: projectsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
