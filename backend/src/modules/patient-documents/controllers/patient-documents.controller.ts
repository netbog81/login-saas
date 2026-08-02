import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import Busboy from 'busboy';
import { Readable } from 'stream';
import {
  AuthorizationGuard,
  RequirePermissions,
} from '../../users/guards/authorization.guard';
import {
  CurrentUser,
  CurrentUserContext,
} from '../../users/decorators/current-user.decorator';
import { PatientDocumentsService } from '../services/patient-documents.service';
import { PatientDocumentCategory } from '../entities/patient-document-enums';

/**
 * REST per il trasferimento binario dei documenti paziente.
 * I metadati (elenco/filtri/update/delete) viaggiano su GraphQL —
 * qui SOLO upload multipart streaming e download.
 *
 * L'upload NON bufferizza mai il file: busboy → cifratura AES-256-GCM
 * → S3 multipart, tutto in streaming (vedi PatientDocumentsService).
 */
@Controller('api/patient-documents')
export class PatientDocumentsController {
  constructor(private readonly documents: PatientDocumentsService) {}

  /**
   * Upload di UN file per la scheda paziente.
   * multipart/form-data — campi form (tutti opzionali tranne il file):
   *   file, therapeuticPathId, treatmentId, category, notes,
   *   description, externalDoctorName
   *
   * Il frontend carica più file con più POST (concorrenza limitata lato
   * client) così ogni file ha DEK, progress e retry indipendenti.
   */
  @Post('subjects/:subjectId')
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('patient_write')
  async upload(
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
    @Req() req: Request,
    @CurrentUser() user: CurrentUserContext,
  ): Promise<unknown> {
    const maxFileMb = parseInt(process.env.DOCS_MAX_FILE_MB || '500', 10);

    return new Promise((resolve, reject) => {
      let busboy: Busboy.Busboy;
      try {
        busboy = Busboy({
          headers: req.headers,
          limits: { files: 1, fileSize: maxFileMb * 1024 * 1024 },
        });
      } catch (err) {
        return reject(new BadRequestException('Invalid multipart request'));
      }

      const fields: Record<string, string> = {};
      let uploadPromise: Promise<unknown> | null = null;

      busboy.on('field', (name, value) => {
        fields[name] = value;
      });

      busboy.on('file', (name, fileStream, info) => {
        if (name !== 'file') {
          fileStream.resume(); // scarta parti inattese
          return;
        }

        // Oltre il limite: busboy tronca lo stream → abortiamo l'upload
        fileStream.on('limit', () => {
          fileStream.destroy(
            new BadRequestException(`File exceeds ${maxFileMb}MB limit`),
          );
        });

        const originalFileName = decodeURIComponent(info.filename || 'documento');
        uploadPromise = this.documents.uploadDocument({
          subjectId,
          fileStream: fileStream as unknown as Readable,
          originalFileName,
          mimeType: info.mimeType || 'application/octet-stream',
          therapeuticPathId: fields['therapeuticPathId'] || undefined,
          treatmentId: fields['treatmentId'] || undefined,
          category: (fields['category'] as PatientDocumentCategory) || undefined,
          notes: fields['notes'] || undefined,
          description: fields['description'] || undefined,
          externalDoctorName: fields['externalDoctorName'] || undefined,
          uploadedBy: user?.userId,
          organizationId: user?.orgId || undefined,
        });
      });

      busboy.on('error', (err) => reject(err));
      busboy.on('finish', () => {
        if (!uploadPromise) {
          return reject(new BadRequestException('Missing "file" part in multipart body'));
        }
        uploadPromise.then(resolve).catch(reject);
      });

      req.pipe(busboy);
    });
  }

  /**
   * Download del plaintext decifrato, in streaming.
   * Content-Length = fileSize (GCM: ciphertext e plaintext hanno la
   * stessa lunghezza, l'auth tag è nei metadati DB).
   */
  @Get(':id/download')
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('patient_read')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { document, stream } = await this.documents.downloadDocument(id);

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Length', document.fileSize);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(document.originalFileName)}`,
    );
    res.setHeader('Cache-Control', 'private, no-store');

    stream.on('error', (err) => {
      // Auth tag GCM invalido o errore S3 a metà stream: la risposta è
      // già partita — possiamo solo troncare (il client vede ERR_INCOMPLETE)
      if (!res.headersSent) {
        res.status(500).json({ message: 'Document stream failed' });
      } else {
        res.destroy(err);
      }
    });

    stream.pipe(res);
  }
}
