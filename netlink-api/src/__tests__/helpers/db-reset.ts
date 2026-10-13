// SAFE TABLE CLEANUP
/**
 * COMPLETELY PURGES ALL DATA FROM THE TEST DATABASE.
 * GUARANTEEED TO ONLY RUN WHEN ASSERTIONS FROM DB-GUARD SUCCESSFULLY PASS.
**/

import { prisma } from '../../config/prisma';
import { assertTestDatabase } from './db-guard';

export async function clearTestDatabase(): Promise<void> {
    // GUARD CHECK
    assertTestDatabase();

    // DEL CHILD/INDEPENDENT MODELS FIRST, --> AVOID FK CONSTRAINT ERRORS || ISSUES =)
    await prisma.notification.deleteMany();
    await prisma.mention.deleteMany();
    await prisma.message.deleteMany();
    await prisma.chatHidden.deleteMany();
    await prisma.chatParticipant.deleteMany();
    await prisma.chat.deleteMany();
    await prisma.favorite.deleteMany();
    await prisma.report.deleteMany();
    await prisma.mute.deleteMany();
    await prisma.block.deleteMany();
    await prisma.share.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.like.deleteMany();
    await prisma.post.deleteMany();
    await prisma.follow.deleteMany();
    await prisma.user.deleteMany();
}