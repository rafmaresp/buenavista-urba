import { app } from '@azure/functions';
import { health } from '../health';

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: () => health(),
});
