import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { TagService } from '../services/tagService.js';

const router = Router();

router.use(authenticateToken);

// 1. Get all tags for user
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const tags = await TagService.getUserTags(userId);
    res.status(200).json({ tags });
  } catch (err) {
    next(err);
  }
});

// 2. Create custom tag
router.post('/', async (req: AuthRequest, res: Response, next): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { name } = req.body;

    if (!name || name.trim() === '') {
      res.status(400).json({ error: 'Tag name is required.', code: 'NAME_REQUIRED' });
      return;
    }

    const tag = await TagService.createTag(userId, name);
    res.status(201).json({ tag });
  } catch (err) {
    next(err);
  }
});

// 3. Delete tag
router.delete('/:id', async (req: AuthRequest, res: Response, next): Promise<void> => {
  try {
    const userId = req.user!.id;
    const tagId = req.params.id as string;

    const deleted = await TagService.deleteTag(tagId, userId);
    if (!deleted) {
      res.status(404).json({ error: 'Tag not found.', code: 'NOT_FOUND' });
      return;
    }

    res.status(200).json({ message: 'Tag deleted successfully.', id: tagId });
  } catch (err) {
    next(err);
  }
});

export default router;
