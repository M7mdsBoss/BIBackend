import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import { getPdfPath } from '../qr-code/pdf.service';

export function createPdfRouter() {
  const router = Router();

  router.get('/:id', (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const filePath = getPdfPath(id);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ message: 'PDF not found.' });
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="visit_${id}.pdf"`);
    fs.createReadStream(filePath).pipe(res);
  });

  return router;
}
