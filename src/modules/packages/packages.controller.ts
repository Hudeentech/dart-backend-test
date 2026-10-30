import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PackagesService } from './packages.service';
import {
  CreatePackageDto,
  DeleteInboundPackagesDto,
  DeletePackageDraftsDto,
  LinkInboundPackageDto,
  SavePackageDraftDto,
} from './dto/package.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';

@ApiTags('Packages')
@ApiBearerAuth()
@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Get('drafts')
  @ApiOperation({ summary: 'List saved package drafts for the current customer' })
  async listDrafts(@CurrentUser('id') userId: string) {
    return this.packagesService.listDrafts(userId);
  }

  @Get('drafts/:id')
  @ApiOperation({ summary: 'Get a saved package draft' })
  async getDraft(
    @CurrentUser('id') userId: string,
    @Param('id') draftId: string,
  ) {
    return this.packagesService.getDraft(userId, draftId);
  }

  @Post('drafts')
  @ApiOperation({ summary: 'Save a new package draft' })
  async createDraft(
    @CurrentUser('id') userId: string,
    @Body() dto: SavePackageDraftDto,
  ) {
    return this.packagesService.createDraft(userId, dto);
  }

  @Patch('drafts/:id')
  @ApiOperation({ summary: 'Update a saved package draft' })
  async updateDraft(
    @CurrentUser('id') userId: string,
    @Param('id') draftId: string,
    @Body() dto: SavePackageDraftDto,
  ) {
    return this.packagesService.updateDraft(userId, draftId, dto);
  }

  @Delete('drafts/bulk')
  @ApiOperation({ summary: 'Delete multiple saved package drafts' })
  async deleteDrafts(
    @CurrentUser('id') userId: string,
    @Body() dto: DeletePackageDraftsDto,
  ) {
    return this.packagesService.deleteDrafts(userId, dto.draftIds);
  }

  @Delete('drafts/:id')
  @ApiOperation({ summary: 'Delete a saved package draft' })
  async deleteDraft(
    @CurrentUser('id') userId: string,
    @Param('id') draftId: string,
  ) {
    return this.packagesService.deleteDraft(userId, draftId);
  }

  @Post()
  @ApiOperation({ summary: 'Create package, destinations, and drafted order' })
  async createPackage(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePackageDto,
  ) {
    return this.packagesService.createPackage(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List user created packages' })
  async listPackages(@CurrentUser('id') userId: string) {
    return this.packagesService.listUserPackages(userId);
  }

  // ----------------------------------------------------
  // INBOUND PACKAGES
  // ----------------------------------------------------

  @Post('inbound')
  @ApiOperation({ summary: 'Link an external inbound shipment to customer account' })
  async linkInbound(
    @CurrentUser('id') userId: string,
    @Body() dto: LinkInboundPackageDto,
  ) {
    return this.packagesService.linkInboundPackage(userId, dto);
  }

  @Get('inbound')
  @ApiOperation({ summary: 'List all linked inbound packages for authenticated customer' })
  async listInbound(@CurrentUser('id') userId: string) {
    return this.packagesService.listInboundPackages(userId);
  }

  @Delete('inbound/bulk')
  @ApiOperation({ summary: 'Unlink multiple deletable inbound packages' })
  async unlinkInboundPackages(
    @CurrentUser('id') userId: string,
    @Body() dto: DeleteInboundPackagesDto,
  ) {
    return this.packagesService.unlinkInboundPackages(userId, dto.packageIds);
  }

  @Public()
  @Get('inbound/track/:trackingId')
  @ApiOperation({ summary: 'Query live tracking milestones and waybill status for inbound parcel' })
  async trackInbound(@Param('trackingId') trackingId: string) {
    return this.packagesService.trackInboundPackage(trackingId);
  }

  @Get('inbound/:id')
  @ApiOperation({ summary: 'Get details of a linked inbound package' })
  async getInbound(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.packagesService.getInboundPackage(userId, id);
  }

  @Delete('inbound/:id')
  @ApiOperation({ summary: 'Unlink an inbound package from customer account' })
  async unlinkInbound(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.packagesService.unlinkInboundPackage(userId, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get package details with addresses and order status' })
  async getPackage(
    @CurrentUser('id') userId: string,
    @Param('id') packageId: string,
  ) {
    return this.packagesService.getPackageById(userId, packageId);
  }
}
