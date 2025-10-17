import { configureStore, createSlice } from '@reduxjs/toolkit';

// Placeholder slice until we add real features
const appSlice = createSlice({
  name: 'app',
  initialState: {
    initialized: true,
  },
  reducers: {},
});

export const store = configureStore({
  reducer: {
    app: appSlice.reducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
